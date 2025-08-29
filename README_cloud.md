# KISH Band Portal · Cloud Starter (Firebase)

이 버전은 Firebase **Auth + Firestore**를 사용해 데이터를 클라우드에 저장/동기화합니다.

## 구성 파일
- `index.html` — 앱 UI
- `styles.css` — 스타일
- `app.js` — 기능 구현(ES Modules) + Firebase SDK CDN import
- `firebase-config.js` — **프로젝트 설정 입력**(샘플 포함)
- `firestore.rules` — 보안 규칙 (로컬에서 배포)

## 빠른 시작
1. Firebase 프로젝트 생성 → Web App 등록
2. `firebase-config.js`에 **프로젝트 설정 값**과 `ADMIN_EMAIL` 입력
3. `firestore.rules` 첫 줄의 관리자 이메일도 동일하게 바꿔주세요.
4. Firebase 콘솔 → Build → Firestore Database → **규칙 배포**
5. GitHub Pages로 이 폴더를 업로드 (또는 firebase hosting 사용)

### 관리자 계정
- `ADMIN_EMAIL`로 가입하면 **자동 승인 + 관리자 권한**이 부여됩니다.
- 이후 관리자 탭에서 사용자 승인/수정/삭제/비번재설정(메일) 관리 가능.

## 데이터 구조
- `users/{uid}`: { name, email, dept, part, partCustom, role('admin'|'member'), approved(bool), createdAt }
- `songs/{id}`: { title, artist, version, parts:[{key,label,player,ref,misc,builtin}], createdAt, createdBy }
- `posts/{id}`: { title, body, authorUid, authorName, createdAt }
- `posts/{id}/comments/{cid}`: { body, authorUid, authorName, createdAt }
- `logs/{id}`: (옵션) 관리자 이벤트 기록

## 권한(보안 규칙 핵심)
- 로그인 + 승인된 사용자만(approved) `songs`, `posts` 읽기/작성 가능
- 관리자만 `songs` 작성/수정/삭제, `logs` 접근 가능
- 각 사용자 문서는 본인(또는 관리자)만 읽기/수정 가능

## 주의
- 관리자 외 **클라이언트에서 타 사용자 비밀번호 변경은 불가** → 비밀번호 재설정 메일로 처리
- Firestore 규칙은 반드시 `ADMIN_EMAIL` 값과 **동일**하게 설정하세요.
