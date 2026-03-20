# TrialShield Integration Demo

Este es un entorno de prueba separado del proyecto principal, creado específicamente para demostrar cómo se integra TrialShield (como SDK en el frontend y comunicándose con el API).

## 🚀 Cómo probarlo

1. Asegúrate de que **TrialShield (el proyecto principal)** esté corriendo en el puerto 3000.
2. Abre una nueva terminal.
3. Navega a esta carpeta: `cd /Users/tomascorzo/Documents/TrialShield/tester-app`
4. Inicia este entorno de prueba:
   ```bash
   npm run dev
   ```
5. Abre `http://localhost:5173` en tu navegador.

## 🧪 Pruebas a realizar

1. **Registro limpio:** Registra un email y teléfono en la página principal. Deberías ver "Decision: ALLOW" con 0% de Match.
2. **Dashboard Actions:** Usa los botones de "Ask AI", "Upload File", etc. para enviar metadata a la API (simulando que el usuario usa tu software).
3. **Múltiples cuentas:** Abre una **Ventana de Incógnito** e intenta registrarte con OTRO email, pero la misma computadora.
4. **Magia TrialShield:** En la cuenta 2, dale click a "Upload File" (que subirá el mismo archivo del primer usuario). Verás que la API **inmediatamente** detecta el reuso de contenido combinado con el fingerprint del device, el `Match Score` se disparará y la cuenta quedará revocada en tiempo real.

*Nota: Esta aplicación es completamente estática y no modifica tu base de datos directamente, sólo consume tus endpoints `/verify` y `/track`.*
