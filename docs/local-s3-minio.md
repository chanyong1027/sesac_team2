# 로컬 S3(MinIO) 실행 가이드

1) MinIO 실행: `docker compose -f docker-compose.minio.yml up -d`
2) MinIO 콘솔 접속: http://localhost:9001 (ID/PW: minioadmin/minioadmin)
3) 버킷 생성: `local-rag-bucket`
4) 앱 실행 시 프로필 활성화: `SPRING_PROFILES_ACTIVE=local`
5) 통합 테스트 실행(선택): `RUN_MINIO_TESTS=true ./gradlew test --tests S3ApiClientIT`
6) S3 업로드는 `storage.s3.*` 설정을 사용합니다.
7) 종료: `docker compose -f docker-compose.minio.yml down`
