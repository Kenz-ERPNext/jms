import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// The desk's Bootstrap utilities (.p-5, .shadow-sm, .border, ...) use
// !important, so they would beat the dashboard's Tailwind classes of the same
// name. Make every rule scoped to .jms-dashboard !important as well; being more
// specific, ours then win, and only inside the dashboard.
const scopedImportant = {
  postcssPlugin: 'jms-scoped-important',
  Declaration(decl) {
    const rule = decl.parent
    if (rule && rule.selector && rule.selector.includes('.jms-dashboard')) {
      decl.important = true
    }
  },
}

export default {
  plugins: [tailwindcss, autoprefixer, scopedImportant],
}
