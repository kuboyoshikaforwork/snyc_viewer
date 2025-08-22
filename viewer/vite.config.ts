import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {viteStaticCopy} from 'vite-plugin-static-copy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      // Web Worker用設定
      // laz-perf.wasmファイルはビルドの実行によって出力フォルダに
      // コピーされないため手動(プラグイン)でファイルをコピーする。
      targets: [
        {
          src: 'src/assets/viewer/laz-perf.wasm',
          dest: 'assets/',
        },
      ],
    }),
  ],
  server: {
    port: 8080,
  },
  // Web Worker用設定
  worker: {
    format: 'es',
  },
});
