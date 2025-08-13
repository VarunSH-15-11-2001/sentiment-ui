# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
# Use install (not ci) so we can add dev deps below
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Ensure Tailwind v4 PostCSS plugin is present
RUN npm i -D @tailwindcss/postcss

# Bring in source
COPY . .

# Write PostCSS config for Tailwind v4
# (overwrites if present; OK for container-only builds)
RUN printf '%s\n' \
'export default {' \
'  plugins: {' \
"    '@tailwindcss/postcss': {}," \
'  },' \
'}' > postcss.config.js

# Create minimal Tailwind CSS entry if missing
RUN mkdir -p src && printf '%s\n' '@import "tailwindcss";' > src/index.css

# Ensure index.css is imported in main.jsx
RUN if [ -f src/main.jsx ] && ! grep -q "import './index.css'" src/main.jsx; then \
      (sed -i "1i import './index.css';" src/main.jsx || \
       (apk add --no-cache gnu-sed && gsed -i "1i import './index.css';" src/main.jsx)); \
    fi

# Build
RUN npm run build


# --- runtime stage ---
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy build output
COPY --from=build /app/dist ./dist

# Copy entrypoint that writes runtime config (creates default if template is missing)
COPY docker-entrypoint.sh /docker-entrypoint.d/10-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/10-runtime-config.sh

# Nginx site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Default API base (override with -e API_BASE=...)
ENV API_BASE="http://localhost:8080"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

