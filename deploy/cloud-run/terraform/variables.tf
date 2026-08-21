variable "project_id" {
  description = "Dedicated Google Cloud project owned by IT."
  type        = string
}

variable "region" {
  description = "Google Cloud region approved for employee data."
  type        = string
  default     = "us-east1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "people-pulse"
}

variable "image_digest" {
  description = "Immutable Artifact Registry image reference ending in @sha256:<digest>. Tags are not accepted for production."
  type        = string
  validation {
    condition     = can(regex("@sha256:[a-f0-9]{64}$", var.image_digest))
    error_message = "image_digest must be an immutable sha256 image reference."
  }
}

variable "workspace_domain" {
  description = "Google Workspace hosted domain allowed inside the signed IAP assertion."
  type        = string
}

variable "iap_access_group" {
  description = "Authoritative Google Group principal, for example group:people-pulse-hr@example.com."
  type        = string
  validation {
    condition     = can(regex("^group:[^@\\s]+@[^@\\s]+$", var.iap_access_group))
    error_message = "iap_access_group must be a Google group principal."
  }
}

variable "snapshot_bucket_name" {
  description = "Globally unique private bucket containing validated weekly JSON snapshots."
  type        = string
}

variable "decision_bucket_name" {
  description = "Globally unique private bucket containing the append-preserved decision record."
  type        = string
}

variable "slack_read_mode" {
  description = "Effective collection mode shown in the dashboard. Keep MOCK until the read-only Slack pilot gate is approved."
  type        = string
  default     = "MOCK"
  validation {
    condition     = contains(["MOCK", "LIVE"], var.slack_read_mode)
    error_message = "slack_read_mode must be MOCK or LIVE."
  }
}

variable "ai_mode" {
  description = "Effective summarization mode shown in the dashboard."
  type        = string
  default     = "MOCK"
  validation {
    condition     = contains(["MOCK", "LIVE"], var.ai_mode)
    error_message = "ai_mode must be MOCK or LIVE."
  }
}

variable "chat_mode" {
  description = "Embedded Ask People Pulse provider mode. Keep MOCK until the live chat privacy and cost gate is approved."
  type        = string
  default     = "MOCK"
  validation {
    condition     = contains(["MOCK", "LIVE"], var.chat_mode)
    error_message = "chat_mode must be MOCK or LIVE."
  }
}

variable "chat_model" {
  description = "Anthropic model used only for embedded Ask People Pulse when chat_mode is LIVE."
  type        = string
  default     = ""
}

variable "anthropic_chat_secret_id" {
  description = "Existing Secret Manager secret ID containing the Anthropic API key for embedded chat. Required only when chat_mode is LIVE."
  type        = string
  default     = ""
}

variable "deletion_protection" {
  description = "Protect production service and buckets from accidental Terraform destruction."
  type        = bool
  default     = true
}
