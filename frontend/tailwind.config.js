// Plain Tailwind, scoped to the dashboard: no preflight and every utility is
// prefixed with `.jms-dashboard`, so nothing leaks into the rest of the desk.
export default {
  important: '.jms-dashboard',
  corePlugins: { preflight: false },
  content: ['./src/**/*.{vue,js}'],
}
