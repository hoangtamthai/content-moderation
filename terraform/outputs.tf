output "server_private_ip" {
  description = "Internal IP address of the server instance."
  value       = google_compute_instance.server-instance.network_interface[0].network_ip
}

output "server_public_ip" {
  description = "External IP address of the server instance."
  value       = google_compute_instance.server-instance.network_interface[0].access_config[0].nat_ip
}

output "client_private_ips" {
  description = "Internal IP addresses of all client instances."
  value = [
    for instance in google_compute_instance.client-instance :
    instance.network_interface[0].network_ip
  ]
}

output "client_public_ip" {
  description = "External IP address of the first client instance, or null if no clients exist."
  value       = try(google_compute_instance.client-instance[0].network_interface[0].access_config[0].nat_ip, null)
}

output "client_public_ips" {
  description = "External IP addresses of all client instances."
  value = [
    for instance in google_compute_instance.client-instance :
    instance.network_interface[0].access_config[0].nat_ip
  ]
}
