# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.2.0 - 2025-11-25
### Changed
- Updated default frontend port to `8008` (was `3000`).
- Updated default backend port to `9009` (was `8000`).
- Frontend API client now supports Server-Side Rendering (SSR) in internal networks.

### Added
- **Load Balancer Support**: Configuration for running behind a load balancer with path rewriting (backend at `/api`).
- **Installer Improvements**: Interactive prompt for deployment domain and automatic CORS configuration.
- **Documentation**: Detailed guide for Google Cloud Load Balancer setup and CORS troubleshooting.
- Support for `API_ROOT_PATH` environment variable for backend proxy configuration.
- Support for `INTERNAL_API_URL` environment variable for frontend internal routing.

## 0.1.0 - 2025-11-23
### Added
- Initial public release of wikigit.
- Core functionality for managing wiki content and API.
- Web interface for content creation and viewing.
