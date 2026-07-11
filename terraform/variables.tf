variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "availability_zone" {
  type    = string
  default = "us-central1-f"
}

variable "ssh_username" {
  type    = string
  default = "pams"
}

variable "stop_all" {
  type = bool
}

variable "ssh_pub_key_file_path" {
  type = string
}

variable "server_machine_type" {
  type = string
}

variable "server_image" {
  type = string
}

variable "is_server_using_spot_provisioning" {
  type = bool
}

variable "server_gpu_enabled" {
  type = bool
}

variable "server_running" {
  type = bool
}

variable "client_machine_type" {
  type = string
}

variable "client_image" {
  type = string
}

variable "number_of_clients" {
  type = number
}

variable "is_client_using_spot_provisioning" {
  type = bool
}

variable "client_running" {
  type = bool
}
