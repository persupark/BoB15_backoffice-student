# boblog 랩 — 로컬(네이티브) 및 docker compose 실행 보조
.PHONY: up down reset-db students test dev vuln-log vuln-log-by-student vuln-log-reset

up: ## docker compose로 전체 기동 + 마이그레이션 + 시드
	docker compose up -d --build
	npm run migrate
	npm run seed
	npm run seed:vuln

down:
	docker compose down

reset-db: ## DB 초기화(볼륨 삭제) 후 재기동
	docker compose down -v
	docker compose up -d postgres redis

students: ## 수강생 개인 계정 21개 발급(진단 실습 대상) → data/students-credentials.csv
	npm run seed:students

vuln-log-by-student: ## 진단 대상(3200)에서 학생별 행위 집계
	@psql "$${DATABASE_URL:-postgres://boblog:boblog@localhost:5432/boblog}" -c "\
	  SELECT coalesce(actor,'(비로그인)') AS 학생, count(*) AS 요청수, \
	         sum(bytes) AS 총바이트, min(occurred_at) AS 시작, max(occurred_at) AS 최종 \
	    FROM vuln.http_log GROUP BY actor ORDER BY actor"

vuln-log: ## 진단 대상(3200)에서 수강생이 한 행위 조회
	@psql "$${DATABASE_URL:-postgres://boblog:boblog@localhost:5432/boblog}" -c "\
	  SELECT to_char(occurred_at,'MM-DD HH24:MI:SS') AS 시각, \
	         coalesce(actor,'(비로그인)') AS 행위자, method, path, \
	         coalesce(query,'') AS 쿼리, status, duration_ms AS ms, bytes \
	    FROM vuln.http_log ORDER BY id DESC LIMIT 50"

vuln-log-reset: ## 실습 시작 전 행위 기록 초기화
	@psql "$${DATABASE_URL:-postgres://boblog:boblog@localhost:5432/boblog}" -c "TRUNCATE vuln.http_log"

test:
	npm test

dev: ## 네이티브 실행(별도 postgres/redis 필요): 서비스 3종 동시 기동
	npx concurrently -n auth,photo,vuln \
		"npm run dev:auth" "npm run dev:photo" "npm run dev:vuln"
