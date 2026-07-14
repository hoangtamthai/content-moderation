project_id            = "content-moderation-502108"           # Your project id (can be found on the upper left-hand side of the GCP console, if you open the dropdown menu)
ssh_pub_key_file_path = "~/.ssh/id_rsa.pub" # Path to your public ssh key file

region            = "us-west4"
availability_zone = "us-west4-b" # The availability zone in which the VMs will be started

stop_all = false # Stop all of the VMs (e.g., if you are finished with your experiments)

server_machine_type               = "g2-standard-4"
server_image                      = "ubuntu-2604-resolute-amd64-v20260421" # You can set your own image here if you have persisted your changes in your own image
is_server_using_spot_provisioning = false                                                   # Use preemptible VMs (cheaper, but can be terminated at any time)
server_gpu_enabled                = true                                                   # Enable GPU on the server (attention: changing this will destroy the current boot disk, ensure that you saved your progress)
server_running                    = true                                                    # Start/Stop the server

client_machine_type               = "e2-standard-2"
client_image                      = "ubuntu-2604-resolute-amd64-v20260421" # You can set your own image here if you have persisted your changes in your own image
number_of_clients                 = 1                                                       # Number of clients to start
is_client_using_spot_provisioning = false                                                   # Use preemptible VMs (cheaper, but can be terminated at any time)
client_running                    = true                                                    # Start/Stop the client(s)
