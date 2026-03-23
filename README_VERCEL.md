# CLOVA Chatbot iframe URL 만들기 (Vercel)

## 1) 배포 파일
- `index.html`: 챗봇 화면
- `api/chat.js`: CLOVA 호출 중계 API (Secret Key 보호)
- `vercel.json`: Vercel 설정

## 2) Vercel에 배포
1. Vercel에서 이 폴더를 Import
2. Environment Variables 추가
   - `CLOVA_API_URL` = CLOVA API Gateway Invoke URL
   - `CLOVA_SECRET_KEY` = CLOVA Secret Key
3. Deploy 실행

배포 후 URL 예시: `https://your-project.vercel.app`

## 3) LMS 게시판에 iframe 삽입
```html
<iframe
  src="https://your-project.vercel.app"
  width="100%"
  height="680"
  style="border:0; border-radius:8px;"
  loading="lazy"
  title="사내 챗봇">
</iframe>
```

## 4) 주의사항
- Secret Key는 절대 프론트 코드(`index.html`)에 넣지 않습니다.
- 반드시 Vercel 환경변수에만 저장합니다.
- iframe이 보이지 않으면 LMS/브라우저의 iframe 보안정책(CSP 등)을 확인합니다.
