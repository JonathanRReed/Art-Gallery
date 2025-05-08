// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import viteCompression from 'vite-plugin-compression';
import cssnano from 'cssnano';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  
  // Optimization settings
  output: 'static',
  build: {
    // Reduce chunk size
    inlineStylesheets: 'never',
  },
  
  vite: {
    plugins: [
      // GZIP compression
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 0, // Compress all files regardless of size
        disable: false,
        verbose: true, // Log compression results
        deleteOriginFile: false, // Keep original files
      }),
      // Brotli compression (more efficient than gzip)
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 0, // Compress all files regardless of size
        compressionOptions: { level: 11 }, // Maximum compression level
        deleteOriginFile: false,
      }),
    ],
    build: {
      // Improved JS bundling
      minify: 'terser',
      cssMinify: true,
      terserOptions: {
        compress: {
          // Enhanced terser options
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 3, // Multiple optimization passes
          ecma: 2020, // Modern JS features
        },
        mangle: {
          safari10: true, // Safe mangling for Safari
        },
        format: {
          comments: false, // Remove all comments
          preserve_annotations: false,
        },
      },
      // Split chunks for better caching
      rollupOptions: {
        output: {
          // Improved code splitting
          manualChunks: (id) => {
            // Create smaller, more focused chunks
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('jspdf')) return 'vendor-jspdf';
              if (id.includes('tailwind')) return 'vendor-tailwind';
              return 'vendor'; // Other dependencies
            }
            
            // Split application code
            if (id.includes('/components/')) return 'components';
            if (id.includes('/layouts/')) return 'layouts';
            if (id.includes('/assets/')) return 'assets';
          },
          // Limit chunk size
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
    },
    // Optimize assets
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.webp', '**/*.avif'],
    // Add compression for development server
    server: {
      // Enable compression for development server
      fs: {
        strict: false,
      },
      // Improve dev performance
      hmr: {
        overlay: false,
      },
    },
    // Optimize code splitting
    optimizeDeps: {
      // Force inclusion in the optimized bundle
      include: ['react', 'react-dom'],
    },
    // Add CSS optimization for tailwind
    css: {
      postcss: {
        plugins: [
          cssnano({
            preset: ['default', {
              discardComments: {
                removeAll: true,
              },
              minifyFontValues: true,
              minifySelectors: true,
            }],
          }),
        ],
      },
    },
  },
});