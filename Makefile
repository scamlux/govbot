# ===========================================================================
# GovBot — developer Makefile
#
#   make            Install deps, migrate, seed, then run the WHOLE app
#                   (backend :8000 + frontend :5173). Ctrl-C stops both.
#   make help       List all targets.
# ===========================================================================
SHELL := /bin/bash
.DEFAULT_GOAL := dev

BACKEND  := backend
FRONTEND := frontend
VENV     := $(BACKEND)/.venv
PY       := $(VENV)/bin/python
PIP      := $(VENV)/bin/pip

BACKEND_PORT  := 8000
FRONTEND_PORT := 5173

.PHONY: dev run install env migrate seed backend frontend test admin stop \
        up docker down docker-down build logs prod-up prod-down prod-logs clean help

## dev: install + migrate + seed, then start backend & frontend together (default)
dev run: install migrate seed stop
	@echo ""
	@echo "▶  GovBot is starting…"
	@echo "   • Frontend  →  http://localhost:$(FRONTEND_PORT)"
	@echo "   • API       →  http://localhost:$(BACKEND_PORT)/api"
	@echo "   • Admin     →  http://localhost:$(BACKEND_PORT)/admin"
	@echo "   Press Ctrl-C to stop both."
	@echo ""
	@trap 'echo; echo "⏹  Stopping GovBot…"; kill 0' EXIT INT TERM; \
	( cd $(BACKEND) && ./.venv/bin/python manage.py runserver $(BACKEND_PORT) ) & \
	( cd $(FRONTEND) && npm run dev -- --strictPort ) & \
	wait

## stop: free the dev ports (kills any leftover backend/frontend on 8000/5173)
stop:
	@for p in $(BACKEND_PORT) $(FRONTEND_PORT); do \
	  pids=$$(lsof -ti tcp:$$p 2>/dev/null); \
	  if [ -n "$$pids" ]; then echo "▶  Freeing port $$p (pid $$pids)"; kill $$pids 2>/dev/null || true; fi; \
	done; \
	sleep 1; true

## install: set up Python venv + frontend deps + .env files
install: env $(VENV)/.installed $(FRONTEND)/node_modules

env:
	@test -f $(BACKEND)/.env  || cp $(BACKEND)/.env.example  $(BACKEND)/.env
	@test -f $(FRONTEND)/.env || cp $(FRONTEND)/.env.example $(FRONTEND)/.env

$(VENV)/.installed: $(BACKEND)/requirements.txt
	@echo "▶  Creating Python venv + installing backend deps…"
	@test -d $(VENV) || python3 -m venv $(VENV)
	@$(PIP) install -q --upgrade pip
	@$(PIP) install -q -r $(BACKEND)/requirements.txt
	@touch $@

$(FRONTEND)/node_modules: $(FRONTEND)/package.json
	@echo "▶  Installing frontend deps…"
	@cd $(FRONTEND) && npm install
	@touch -c $@

## migrate: apply database migrations
migrate: $(VENV)/.installed
	@cd $(BACKEND) && ./.venv/bin/python manage.py migrate --noinput

## seed: populate the scenario catalog
seed: $(VENV)/.installed
	@cd $(BACKEND) && ./.venv/bin/python manage.py seed_scenarios

## backend: run only the Django API (:8000)
backend: install migrate
	@pids=$$(lsof -ti tcp:$(BACKEND_PORT) 2>/dev/null); [ -n "$$pids" ] && kill $$pids 2>/dev/null || true
	@cd $(BACKEND) && ./.venv/bin/python manage.py runserver $(BACKEND_PORT)

## frontend: run only the Vite dev server (:5173)
frontend: env $(FRONTEND)/node_modules
	@pids=$$(lsof -ti tcp:$(FRONTEND_PORT) 2>/dev/null); [ -n "$$pids" ] && kill $$pids 2>/dev/null || true
	@cd $(FRONTEND) && npm run dev -- --strictPort

## test: run the backend test suite
test: $(VENV)/.installed
	@cd $(BACKEND) && ./.venv/bin/python -m pytest

## admin: create a Django superuser (admin dashboard access)
admin: $(VENV)/.installed
	@cd $(BACKEND) && ./.venv/bin/python manage.py createsuperuser

## up: build + run the full stack with Docker Compose
up docker: env
	docker compose up --build

## down: stop the Docker Compose stack
down docker-down:
	docker compose down

## build: build Docker images without starting
build: env
	docker compose build

## logs: tail Docker Compose logs
logs:
	docker compose logs -f

## prod-up: build + run the PRODUCTION stack (single port 6969)
prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

## prod-down: stop the production stack
prod-down:
	docker compose -f docker-compose.prod.yml down

## prod-logs: tail production logs
prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

## clean: remove venv, node_modules, sqlite db, build artifacts
clean:
	rm -rf $(VENV) $(FRONTEND)/node_modules $(FRONTEND)/dist \
	       $(BACKEND)/db.sqlite3 $(BACKEND)/staticfiles

## help: list available targets
help:
	@echo "GovBot — make targets:"
	@grep -E '^## [a-z].*:' $(MAKEFILE_LIST) | sed -E 's/^## ([a-z-]+( [a-z-]+)*): /  \1|/' \
	  | awk -F'|' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
