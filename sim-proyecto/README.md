# Simulador Económico 🏦

Simulador macro + micro donde manejás la política monetaria de un país: emitís o contraés dinero, movés la tasa de interés, el encaje, los aranceles, intervenís el dólar y decidís medidas de emergencia (cepo, control de precios). Cada **5 segundos pasa un mes** y la economía reacciona: inflación, dólar oficial y blue, reservas, riesgo país, empleo, pobreza, shocks aleatorios y un informe anual.

Hecho con **React + Vite** y **Recharts**.

---

## Probarlo en tu compu

Necesitás [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install      # instala las dependencias (solo la primera vez)
npm run dev      # arranca en http://localhost:5173
```

Para generar la versión publicable:

```bash
npm run build    # genera la carpeta dist/
npm run preview  # previsualiza el build
```

---

## Subirlo a GitHub

```bash
git init
git add .
git commit -m "Simulador económico"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

---

## Publicarlo gratis (para abrirlo desde el teléfono con un link)

### Opción A — Vercel (la más fácil)
1. Entrá a [vercel.com](https://vercel.com) e iniciá sesión con GitHub.
2. **Add New → Project** e importá tu repo.
3. Vercel detecta Vite solo. Dale **Deploy**.
4. Te queda un link público que abrís en cualquier navegador, también del celular.

### Opción B — GitHub Pages (incluido y automático)
Este proyecto ya trae el workflow `.github/workflows/deploy.yml`.
1. En tu repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Cada vez que hagas `push` a `main`, se buildea y publica solo.
3. Queda en `https://TU-USUARIO.github.io/TU-REPO/`.

> El `vite.config.js` usa `base: './'`, así que funciona tanto en Vercel/Netlify (raíz) como en Pages (subcarpeta) sin tocar nada.

---

## Estructura

```
.
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx        # punto de entrada
│   └── App.jsx         # todo el simulador
└── .github/workflows/
    └── deploy.yml      # publicación automática en GitHub Pages
```

## Dependencia externa
- `recharts` (gráficos). Las fuentes se cargan solas desde Google Fonts.

Uso educativo. Modelo simplificado de teoría cuantitativa del dinero (MV = PY), ley de Okun, curva de oferta agregada, paridad de poder de compra y expectativas de inflación.
