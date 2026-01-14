# 1. Base 이미지 설정 (Java 17 사용 시)
FROM eclipse-temurin:17-jdk-alpine

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. JAR 파일 복사
COPY build/libs/app.jar app.jar

# 4. 시간대 설정 (선택 사항: RDS와 시간대를 맞추기 위해 추천)
ENV TZ=Asia/Seoul

# 5. 애플리케이션 실행
ENTRYPOINT ["java", "-jar", "app.jar"]
