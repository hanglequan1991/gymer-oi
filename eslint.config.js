// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const SDK = 'zmp-sdk';
const RELATIVE_DEEP = '../../../*';
const MSG_RELATIVE = 'Dùng alias @/ cho import xuyên thư mục.';

/**
 * Tạo rule no-restricted-imports. Luôn kèm pattern import tương đối sâu,
 * vì ESLint chỉ áp dụng MỘT cấu hình rule cho mỗi file (khối sau ghi đè khối trước).
 */
const ban = (patterns, message) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        ...patterns.map((group) => ({ group: [group], message })),
        { group: [RELATIVE_DEEP], message: MSG_RELATIVE },
      ],
    },
  ],
});

// Nhóm cấm dùng chung. Đặt thành hằng để các khối bên dưới không lệch nhau.
const UI_BANS = [
  '@/services', '@/services/*', '@/platform', '@/platform/*',
  '@/stores', '@/stores/*', '@/hooks', '@/hooks/*',
  '@/features/**', '@/providers', '@/providers/*', '@/routes', '@/routes/*',
  '@/config', '@/config/*', '@/i18n', '@/i18n/*', '@/mocks', '@/mocks/*', SDK,
];
const UI_TEST_BANS = ['@/services', '@/services/*', '@/platform', '@/platform/*', '@/features/**', SDK];
const SERVICES_BANS = [
  'react', 'react-dom', 'react/*', 'zmp-ui',
  '@/components/**', '@/features/**', '@/hooks', '@/hooks/*',
  '@/providers', '@/providers/*', '@/stores', '@/stores/*', SDK,
];
const HOOK_BANS = ['@/components/**', '@/features/**', SDK];
const FEATURE_BANS = ['@/services', '@/services/*', '@/platform', '@/platform/*', '@/mocks', '@/mocks/*', SDK];

// Các khu vực đã có khối riêng; khối "phần còn lại" phải loại trừ đúng những vùng này.
const SPECIAL_AREAS = [
  'src/platform/zmp/**',
  'src/components/ui/**',
  'src/services/**',
  'src/features/**',
  'src/hooks/**',
  'src/providers/**',
  'src/stores/**',
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Nền: mọi file trong src/ chỉ bị cấm import tương đối sâu.
  { files: ['src/**/*.{ts,tsx}'], rules: ban([], MSG_RELATIVE) },

  // Phần còn lại của src/ (không thuộc vùng đặc biệt, gồm cả routes và pages): cấm zmp-sdk.
  // Chỉ src/platform/zmp được dùng zmp-sdk.
  { files: ['src/**/*.{ts,tsx}'], ignores: SPECIAL_AREAS, rules: ban([SDK], 'Chỉ src/platform/zmp được import zmp-sdk.') },

  // 1) UI thuần: không biết dữ liệu, nền tảng, feature. Test của UI có quy tắc riêng.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: ban(UI_BANS, 'components/ui chỉ được dùng types, utils, styles, zmp-ui.'),
  },
  {
    files: ['src/components/ui/**/*.test.{ts,tsx}'],
    rules: ban(UI_TEST_BANS, 'Test của ui không được kéo services/platform/features.'),
  },

  // 2) Services: mã thuần, không React/zmp-ui/UI.
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: ban(SERVICES_BANS, 'services là mã thuần, không biết React/UI.'),
  },

  // 3) Hook, provider, store: không UI, feature, zmp-sdk.
  {
    files: ['src/hooks/**/*.{ts,tsx}', 'src/providers/**/*.{ts,tsx}', 'src/stores/**/*.{ts,tsx}'],
    rules: ban(HOOK_BANS, 'Hook/provider/store không import UI/feature/zmp-sdk.'),
  },

  // 4) Feature: đi qua hooks, không gọi services/platform/mocks trực tiếp.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/features/user/**', 'src/features/gymer/**'],
    rules: ban(FEATURE_BANS, 'Feature đi qua hooks, không gọi services/platform/mocks trực tiếp.'),
  },
  // 5) Chặn chéo giữa hai feature user và gymer (sibling khác còn kiểm bằng review).
  {
    files: ['src/features/user/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: ban(
      [...FEATURE_BANS, '@/features/gymer', '@/features/gymer/**'],
      'Feature đi qua hooks, không gọi services/platform/mocks trực tiếp, và không import feature khác.',
    ),
  },
  {
    files: ['src/features/gymer/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: ban(
      [...FEATURE_BANS, '@/features/user', '@/features/user/**'],
      'Feature đi qua hooks, không gọi services/platform/mocks trực tiếp, và không import feature khác.',
    ),
  },
);
