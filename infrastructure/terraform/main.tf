# ФинКлик — Инфраструктура (Terraform)
# Провайдер: Yandex Cloud (ближайший к Беларуси)
# Запуск: terraform init && terraform apply

terraform {
  required_version = ">= 1.5"
  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.90"
    }
  }
  backend "s3" {
    endpoint = "storage.yandexcloud.net"
    bucket   = "finklik-terraform-state"
    region   = "ru-central1"
    key      = "prod/terraform.tfstate"
    skip_region_validation      = true
    skip_credentials_validation = true
  }
}

provider "yandex" {
  zone      = var.zone
  folder_id = var.folder_id
}

# ── Переменные ────────────────────────────────────────────────────────────────

variable "zone" {
  default = "ru-central1-a"
}

variable "folder_id" {
  description = "Yandex Cloud folder ID"
}

variable "db_password" {
  description = "PostgreSQL password"
  sensitive   = true
}

variable "environment" {
  default = "production"
}

# ── Сеть ─────────────────────────────────────────────────────────────────────

resource "yandex_vpc_network" "finklik" {
  name = "finklik-network"
}

resource "yandex_vpc_subnet" "finklik_a" {
  name           = "finklik-subnet-a"
  zone           = "ru-central1-a"
  network_id     = yandex_vpc_network.finklik.id
  v4_cidr_blocks = ["10.0.1.0/24"]
}

resource "yandex_vpc_subnet" "finklik_b" {
  name           = "finklik-subnet-b"
  zone           = "ru-central1-b"
  network_id     = yandex_vpc_network.finklik.id
  v4_cidr_blocks = ["10.0.2.0/24"]
}

# ── Managed PostgreSQL ────────────────────────────────────────────────────────

resource "yandex_mdb_postgresql_cluster" "finklik" {
  name        = "finklik-postgres"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.finklik.id

  config {
    version = "16"
    resources {
      resource_preset_id = "s2.micro"  # 2 CPU, 8 GB RAM
      disk_type_id       = "network-ssd"
      disk_size          = 50          # GB
    }
    postgresql_config = {
      max_connections                = 200
      shared_buffers_fraction        = 0.25
      effective_cache_size_fraction  = 0.75
    }
    backup_window_start {
      hours   = 2
      minutes = 0
    }
    # Бэкап 30 дней
    backup_retain_period_days = 30
  }

  maintenance_window {
    type = "WEEKLY"
    day  = "SUN"
    hour = 3
  }

  host {
    zone      = "ru-central1-a"
    subnet_id = yandex_vpc_subnet.finklik_a.id
  }
  # Реплика для чтения
  host {
    zone      = "ru-central1-b"
    subnet_id = yandex_vpc_subnet.finklik_b.id
    replication_source_name = "ru-central1-a"
  }
}

resource "yandex_mdb_postgresql_database" "finklik" {
  cluster_id = yandex_mdb_postgresql_cluster.finklik.id
  name       = "finklik"
  owner      = "finklik"
}

resource "yandex_mdb_postgresql_user" "finklik" {
  cluster_id = yandex_mdb_postgresql_cluster.finklik.id
  name       = "finklik"
  password   = var.db_password
  grants     = ["DATABASE finklik"]
}

# ── Managed Redis ─────────────────────────────────────────────────────────────

resource "yandex_mdb_redis_cluster" "finklik" {
  name        = "finklik-redis"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.finklik.id

  config {
    version  = "7.0"
    password = var.db_password
  }

  resources {
    resource_preset_id = "hm1.nano"
    disk_size          = 8
    disk_type_id       = "network-ssd"
  }

  host {
    zone      = "ru-central1-a"
    subnet_id = yandex_vpc_subnet.finklik_a.id
  }
}

# ── Kubernetes кластер ────────────────────────────────────────────────────────

resource "yandex_kubernetes_cluster" "finklik" {
  name       = "finklik-k8s"
  network_id = yandex_vpc_network.finklik.id

  master {
    version = "1.28"
    zonal {
      zone      = "ru-central1-a"
      subnet_id = yandex_vpc_subnet.finklik_a.id
    }
    public_ip = true
  }

  service_account_id      = yandex_iam_service_account.k8s.id
  node_service_account_id = yandex_iam_service_account.k8s_nodes.id
}

resource "yandex_kubernetes_node_group" "finklik_workers" {
  cluster_id = yandex_kubernetes_cluster.finklik.id
  name       = "workers"
  version    = "1.28"

  instance_template {
    platform_id = "standard-v3"
    resources {
      memory = 8   # GB
      cores  = 4
    }
    boot_disk {
      type = "network-ssd"
      size = 50
    }
  }

  scale_policy {
    auto_scale {
      min     = 2
      max     = 10
      initial = 3
    }
  }

  allocation_policy {
    location { zone = "ru-central1-a" }
    location { zone = "ru-central1-b" }
  }
}

# ── Object Storage (S3) для документов ───────────────────────────────────────

resource "yandex_storage_bucket" "documents" {
  bucket = "finklik-documents"
  acl    = "private"

  lifecycle_rule {
    id      = "archive-old-documents"
    enabled = true
    transition {
      days          = 90
      storage_class = "COLD"
    }
  }

  versioning {
    enabled = true
  }
}

# ── IAM ───────────────────────────────────────────────────────────────────────

resource "yandex_iam_service_account" "k8s" {
  name = "finklik-k8s-sa"
}

resource "yandex_iam_service_account" "k8s_nodes" {
  name = "finklik-k8s-nodes-sa"
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "postgres_host" {
  value     = yandex_mdb_postgresql_cluster.finklik.host[0].fqdn
  sensitive = false
}

output "redis_host" {
  value = yandex_mdb_redis_cluster.finklik.host[0].fqdn
}

output "k8s_cluster_id" {
  value = yandex_kubernetes_cluster.finklik.id
}

output "documents_bucket" {
  value = yandex_storage_bucket.documents.bucket
}
