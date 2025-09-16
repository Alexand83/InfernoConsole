#!/bin/bash

echo "Creating self-signed certificate for macOS..."

# Create private key
openssl genrsa -out inferno-console-macos.key 2048

# Create certificate signing request
openssl req -new -key inferno-console-macos.key -out inferno-console-macos.csr -subj "/C=IT/ST=Italy/L=Rome/O=Inferno Console Team/OU=Development/CN=Inferno Console"

# Create self-signed certificate
openssl x509 -req -days 365 -in inferno-console-macos.csr -signkey inferno-console-macos.key -out inferno-console-macos.crt

# Convert to P12 format for macOS
openssl pkcs12 -export -out inferno-console-macos.p12 -inkey inferno-console-macos.key -in inferno-console-macos.crt -password pass:inferno123

# Create PEM format
openssl x509 -outform PEM -in inferno-console-macos.crt -out inferno-console-macos.pem

echo "macOS certificate created successfully!"
echo "Files created:"
echo "- inferno-console-macos.p12 (macOS)"
echo "- inferno-console-macos.pem (PEM format)"
echo "- inferno-console-macos.key (Private key)"
echo "- inferno-console-macos.crt (Certificate)"
echo "- inferno-console-macos.csr (Certificate request)"
echo "Password: inferno123"
