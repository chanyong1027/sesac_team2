FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY build/libs/app.jar app.jar

ENV TZ=Asia/Seoul
ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-Xms256m", \
  "-Xmx384m", \
  "-XX:+UseG1GC", \
  "-jar", "app.jar"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
