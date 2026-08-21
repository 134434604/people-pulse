output "service_uri" {
  description = "HTTPS address to use for the managed HR browser shortcut."
  value       = google_cloud_run_v2_service.people_pulse.uri
}

output "iap_signed_header_audience" {
  description = "Audience independently validated by the People Pulse server."
  value       = local.iap_audience
}

output "authorized_google_group" {
  value = var.iap_access_group
}

output "snapshot_bucket" {
  value = google_storage_bucket.snapshots.name
}

output "decision_bucket" {
  value = google_storage_bucket.decisions.name
}
