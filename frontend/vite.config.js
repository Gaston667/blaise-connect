// Importe les fonctions nécessaires pour configurer Vite.
import { defineConfig, loadEnv } from 'vite'

// Importe le plugin qui permet à Vite de comprendre React et le JSX.
import react from '@vitejs/plugin-react'

// Exporte la configuration principale de Vite.
export default defineConfig(({ mode }) => {
  // Charge les variables commençant par VITE_.
  // Le mode vaut généralement "development" ou "production".
  const env = loadEnv(mode, '.', 'VITE_')

  // Utilise la cible définie dans l'environnement.
  // En dehors de Docker, FastAPI est accessible sur localhost:8000.
  const apiTarget =
    env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  // Retourne les paramètres utilisés par Vite.
  return {
    // Active le fonctionnement de React dans Vite.
    plugins: [react()],

    // Configure le serveur lancé avec npm run dev.
    server: {
      // Le proxy transmet certaines requêtes vers un autre serveur.
      proxy: {
        // Intercepte toutes les adresses qui commencent par /api.
        '/api': {
          // Indique vers quel serveur la requête doit être transmise.
          target: apiTarget,

          // Adapte l'en-tête HTTP Host au serveur FastAPI ciblé.
          changeOrigin: true,

          // Retire /api avant d'envoyer la requête au backend.
          // /api/health devient donc /health.
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})