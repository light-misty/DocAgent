<div align="center">

# Samoyed Work

[![Windows](https://img.shields.io/badge/platform-Windows-blue?logo=windows)](https://github.com/user-attachments/samoyed-work)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.x-orange?logo=tauri)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.80+-000000?logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

[English](./README.md) | [简体中文](./README_zh.md)

<img src="assets/screenshots/English-1.1.5-main.png" alt="Samoyed Work Screenshot" width="800" />
<img src="assets/screenshots/English-1.1.6-workflow-1.png" alt="Samoyed Work Screenshot" width="800" />
<img src="assets/screenshots/English-1.1.6-workflow-2.png" alt="Samoyed Work Screenshot" width="800" />

</div>

## Installation

Download the latest Windows installer from [Releases](https://github.com/light-misty/Samoyed-Work/releases) and run it to install.

## Features

### AI Agent
- Multi-mode agent (Plan / Code / Document modes), autonomous task execution
- SubAgent workflow for complex task decomposition
- Read-only explore mode for safely browsing and analyzing project code
- Permission system with granular control over file and command operations
- Extensible Skill system for loading custom capabilities
- Built-in Superpowers skill development workflow framework
- Multi-turn conversational operations
- Visual context token breakdown to track token usage
- Slash command system: type or click the `/` button to open the command menu (help, compact, retry, stop, new, stats, effort, thinking, etc.)

### Multiple AI Models
- OpenAI-compatible API, Anthropic Claude, Google Gemini, Ollama local models
- Custom API endpoint support
- Health monitoring with auto-recovery
- Real-time token usage tracking
- Reasoning effort (thinking intensity) presets tuned per model

### Workspace Management
- Multiple workspaces mapped to local directories
- File tree browsing and search
- Create, delete, rename files within workspaces
- Git repository status display

### Document Processing (Document Mode)
- Word (.docx): read, create, edit, format conversion, structure analysis
- Excel (.xlsx): read, create, edit, data extraction
- PPT (.pptx): read, create, edit, slide extraction
- PDF: text extraction
- Markdown / Plain Text: read and convert
- Markdown preview supports internal links, math formulas, and emoji rendering
- Markdown preview supports loading images from local relative paths

### Session Management
- Multiple session switching without interference, with Agent background running support
- Session todo tasks
- Version snapshot and message rollback: automatic file snapshots before each message, rollback to any historical message node (with code files restored), undo rollback supported, auto-cleanup of session on full rollback

### Prompt Templates
- Built-in templates for common tasks
- Custom templates with variables
- Category-based organization

### User Experience
- Dark / Light / System theme
- Chinese / English interface
- Global shortcuts (Ctrl+N new session, Ctrl+W close, Ctrl+B sidebar, Ctrl+, settings)
- Multimodal conversations, including attachments such as images and documents
- Automatic update detection and installation
