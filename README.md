# boblog 진단 실습 랩

모의 SNS **boblog**와 그 백오피스(개인정보처리시스템) 진단 실습 대상. **모든 데이터는 가명·합성 데이터입니다.**

## 과제

개인정보의 안전성 확보조치 기준에 따라 **boblog 개인정보처리시스템**이 준수해야 하는 요구사항을 식별하고, 진단 기준을 마련하여 진단·개선하십시오.

기업 Compliance 담당자로서, 진단을 통해 발견한 사항을 유관 부서와 어떻게 개선할 것인지 **미팅에 필요한 자료**를 작성하십시오.

### 기업 현황

- 지정된 시간이 되면 자신의 사진을 친구와 공유하는 서비스 **boblog**를 운영하는 기업에 재직 중입니다.
- 이 기업은 모든 환경이 AWS이며, 임직원 50명 이하 중 보안 조직은 3명 — 여러분은 그중 한 명입니다.
- 폭발적인 인기 덕분에 투자를 유치했고, **ISMS 인증 대상으로 선정되어 올해 11월 심사**를 받아야 합니다.

### 조건

- AI는 자유롭게 활용할 수 있습니다.
- **Agent를 사용할 경우 Korea Law MCP를 반드시 사용**해야 합니다.

### 평가 항목

- Compliance 요구사항의 타당성과 기준의 적절성
- 진단 결과·개선 방안의 타당성과 적절성
- 유관 부서와의 커뮤니케이션 적합성(용이성, 가시성 등)
- 전체 내용을 스스로 이해하고 있는지

## 구성

| 서비스 | 포트 | 설명 |
|---|---|---|
| auth-member | 3001 | boblog 미니 웹사이트(가입·로그인·피드·업로드 BFF) |
| photo | 3002 | 사진 내부 API (서비스 토큰 인증, auth-member가 호출) |
| backoffice-vuln | 3200 | 진단 실습 대상 백오피스(개인정보처리시스템) |

## 설치 및 실행

로컬에서 실행합니다. 아래 두 방법 중 하나를 선택하세요.

### 방법 1 — Docker (Windows / macOS 공통, 권장)

사전 설치 3가지: [Docker Desktop](https://www.docker.com/products/docker-desktop/) · [Node.js](https://nodejs.org/) **22 이상(LTS)** · [Git](https://git-scm.com/downloads)
(Git이 없으면 GitHub 저장소 페이지의 **Code → Download ZIP**으로 받아서 압축을 풀어도 됩니다.)

```bash
git clone https://github.com/persupark/BoB15_backoffice-student.git
cd BoB15_backoffice-student
cp .env.example .env
docker compose up -d --build
npm install
npm run migrate && npm run seed && npm run seed:vuln
```

- 서비스: http://localhost:3001
- 백오피스(진단 실습 대상): http://localhost:3200

> Windows PowerShell에서는 `cp` 대신 `copy .env.example .env`를 사용하세요.

### 방법 2 — 네이티브 실행 (Docker 없이)

#### macOS

```bash
brew install git node postgresql@16 redis
brew services start postgresql@16 redis
createuser -s boblog; createdb -O boblog boblog; psql -c "ALTER USER boblog PASSWORD 'boblog'"
git clone https://github.com/persupark/BoB15_backoffice-student.git
cd BoB15_backoffice-student
cp .env.example .env && npm install && npm run migrate && npm run seed && npm run seed:vuln
npm run dev:auth & npm run dev:photo & npm run dev:vuln
```

#### Windows

Redis는 Windows를 공식 지원하지 않으므로 **WSL2(Ubuntu)** 사용을 권장합니다.

1. PowerShell(관리자 권한)에서 WSL2 설치: `wsl --install` 후 재부팅
2. WSL(Ubuntu) 안에서:

```bash
sudo apt update && sudo apt install -y git postgresql redis-server curl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs
sudo service postgresql start && sudo service redis-server start
sudo -u postgres createuser -s boblog
sudo -u postgres createdb -O boblog boblog
sudo -u postgres psql -c "ALTER USER boblog PASSWORD 'boblog'"
git clone https://github.com/persupark/BoB15_backoffice-student.git
cd BoB15_backoffice-student
cp .env.example .env && npm install && npm run migrate && npm run seed && npm run seed:vuln
npm run dev:auth & npm run dev:photo & npm run dev:vuln
```

3. Windows 브라우저에서 `http://localhost:3001`, `http://localhost:3200`으로 접속(WSL2는 localhost가 자동 연결됩니다).

## 진단 실습 대상 (backoffice-vuln, :3200)

개인정보의 안전성 확보조치 기준의 **기술적 보호조치** 관점에서 이 시스템을 진단하고, 발견사항을 조항별로 정리한 보고서를 작성하세요.

- 코드 레벨 취약점(SQL 인젝션, XSS 등)은 이번 실습 범위가 아닙니다.
- 데이터는 전부 가명·합성 데이터입니다.

시드 데모 계정(비밀번호 공통 `Passw0rd!`)
- 서비스: `demo@boblog.dev`
- 백오피스(3200): `vadmin` `vstaff` `vpart`

### 수강생 개인 계정 (1인 1계정, 선택)

여러 명이 같은 인스턴스를 공유해서 쓰는 경우, 개인별 계정을 발급해 접속기록으로 구분할 수 있습니다.

```bash
make students     # student01~student21 발급 → data/students-credentials.csv
```

```bash
SEED_STUDENTS=30 make students                 # 인원 변경
SEED_STUDENTS_FORCE=1 npm run seed:students    # 비밀번호 재발급
```

### 실습 행위 추적

3200에 대한 모든 HTTP 요청은 `vuln.http_log`와 컨테이너 로그(JSON)에 기록됩니다.

```bash
make vuln-log-reset        # 실습 시작 전 초기화
make vuln-log              # 요청 목록(누가 언제 무엇을 요청했는지)
make vuln-log-by-student   # 학생별 집계(요청수·총바이트·시작/최종)
docker compose logs -f backoffice-vuln   # 실시간(JSON 한 줄씩)
```

## 테스트 (선택)

```bash
# 최초 1회 — 네이티브 실행이면: createdb -O boblog boblog_test
# Docker 실행이면: docker compose exec postgres createdb -U boblog -O boblog boblog_test
npm test
```
