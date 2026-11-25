import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': GitHub Pages 하위 경로(seoulbhin.github.io/hoek/)에서도 그대로 열리게 모든 주소를 상대 경로로
export default defineConfig({
  base: './',
  plugins: [react()],
});
