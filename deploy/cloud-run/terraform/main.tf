data "google_project" "current" {
  project_id = var.project_id
}

locals {
  iap_audience = "/projects/${data.google_project.current.number}/locations/${var.region}/services/${var.service_name}"
  required_apis = toset([
    "artifactregistry.googleapis.com",
    "iap.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com"
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "people-pulse-runtime"
  display_name = "People Pulse Cloud Run runtime"
}

resource "google_storage_bucket" "snapshots" {
  project                     = var.project_id
  name                        = var.snapshot_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning { enabled = true }
  soft_delete_policy { retention_duration_seconds = 604800 }
  lifecycle_rule {
    action { type = "Delete" }
    condition {
      age                = 30
      with_state         = "ARCHIVED"
      num_newer_versions = 3
    }
  }
}

resource "google_storage_bucket" "decisions" {
  project                     = var.project_id
  name                        = var.decision_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning { enabled = true }
  soft_delete_policy { retention_duration_seconds = 2592000 }
  lifecycle_rule {
    action { type = "Delete" }
    condition {
      age                = 365
      with_state         = "ARCHIVED"
      num_newer_versions = 50
    }
  }
}

resource "google_storage_bucket_iam_member" "snapshot_reader" {
  bucket = google_storage_bucket.snapshots.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_storage_bucket_iam_member" "decision_writer" {
  bucket = google_storage_bucket.decisions.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "chat_api_key" {
  count     = var.chat_mode == "LIVE" ? 1 : 0
  project   = var.project_id
  secret_id = var.anthropic_chat_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "people_pulse" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  iap_enabled         = true
  deletion_protection = var.deletion_protection

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = "30s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 1
      max_instance_count = 1
    }

    containers {
      image = var.image_digest

      ports { container_port = 8080 }
      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle = true
      }

      env {
        name  = "PP_DATA_MODE"
        value = "LIVE"
      }
      env {
        name  = "PP_SLACK_READ_MODE"
        value = var.slack_read_mode
      }
      env {
        name  = "PP_AI_MODE"
        value = var.ai_mode
      }
      env {
        name  = "PP_CHAT_MODE"
        value = var.chat_mode
      }
      env {
        name  = "PP_CHAT_MODEL"
        value = var.chat_model
      }
      env {
        name  = "PP_CHAT_REQUESTS_PER_MINUTE"
        value = "12"
      }
      env {
        name  = "PP_CHAT_COST_BUDGET_USD"
        value = "0.50"
      }
      dynamic "env" {
        for_each = var.chat_mode == "LIVE" ? [1] : []
        content {
          name = "ANTHROPIC_API_KEY"
          value_source {
            secret_key_ref {
              secret  = var.anthropic_chat_secret_id
              version = "latest"
            }
          }
        }
      }
      env {
        name  = "PP_NOTIFY_MODE"
        value = "OFF"
      }
      env {
        name  = "PP_IAP_AUDIENCE"
        value = local.iap_audience
      }
      env {
        name  = "PP_GOOGLE_WORKSPACE_DOMAIN"
        value = var.workspace_domain
      }
      env {
        name  = "PP_INSIGHTS_DIRECTORY"
        value = "/mnt/people-pulse/insights"
      }
      env {
        name  = "PP_DECISION_PATH"
        value = "/mnt/people-pulse/decisions/decisions.json"
      }
      env {
        name  = "PP_HTTP_REQUESTS_PER_MINUTE"
        value = "120"
      }

      volume_mounts {
        name       = "snapshots"
        mount_path = "/mnt/people-pulse/insights"
      }
      volume_mounts {
        name       = "decisions"
        mount_path = "/mnt/people-pulse/decisions"
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 12
        http_get {
          path = "/api/health"
          port = 8080
        }
      }
      liveness_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3
        http_get {
          path = "/api/health"
          port = 8080
        }
      }
    }

    volumes {
      name = "snapshots"
      gcs {
        bucket        = google_storage_bucket.snapshots.name
        read_only     = true
        mount_options = ["uid=1000", "gid=1000", "implicit-dirs"]
      }
    }
    volumes {
      name = "decisions"
      gcs {
        bucket        = google_storage_bucket.decisions.name
        read_only     = false
        mount_options = ["uid=1000", "gid=1000", "implicit-dirs"]
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_storage_bucket_iam_member.snapshot_reader,
    google_storage_bucket_iam_member.decision_writer,
    google_secret_manager_secret_iam_member.chat_api_key
  ]

  lifecycle {
    precondition {
      condition     = var.chat_mode == "MOCK" || (length(trimspace(var.chat_model)) > 0 && length(trimspace(var.anthropic_chat_secret_id)) > 0)
      error_message = "LIVE chat requires chat_model and anthropic_chat_secret_id."
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  project  = google_cloud_run_v2_service.people_pulse.project
  location = google_cloud_run_v2_service.people_pulse.location
  name     = google_cloud_run_v2_service.people_pulse.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-iap.iam.gserviceaccount.com"
}

resource "google_iap_web_cloud_run_service_iam_binding" "authorized_hr" {
  project                = var.project_id
  location               = var.region
  cloud_run_service_name = google_cloud_run_v2_service.people_pulse.name
  role                   = "roles/iap.httpsResourceAccessor"
  members                = [var.iap_access_group]
}
