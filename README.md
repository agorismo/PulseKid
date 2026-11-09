# pulsekid

DAW web minimalista focado em gravação e plugins. Arquivo único, sem dependências.

- Gravação multitrack com overdub, monitor de entrada e compensação de latência
- Rack de plugins por trilha e no master: EQ, compressor, reverb, delay, drive, chorus, filtro, phaser, flanger, tremolo, bitcrush, limiter, noise gate
- Plugins de terceiros via WAM (Web Audio Modules): cole a URL do index.js do plugin (experimental)
- Afinador (correção de pitch tipo auto-tune): selecione um clipe e clique em "afinar"; escolha tom, escala, força e velocidade
- Metrônomo (bpm), contagem de 1 compasso antes de gravar, loop (arraste na régua) e snap à grade
- Edição de clipes: mover (inclusive entre trilhas), aparar bordas, fade in/out (bolinhas no topo do clipe), cortar, duplicar, apagar, desfazer/refazer
- Vários takes por trilha: gravar por cima de um trecho já gravado cria um novo take (botão tN/M na trilha troca; shift+clique apaga)
- Zoom horizontal e vertical (altura das trilhas)
- Projeto salvo automaticamente no navegador (IndexedDB), incluindo o estado dos plugins WAM; importar áudio e exportar WAV

Atalhos: espaço play/pause · R gravar · M metrônomo · L loop · S cortar · Delete apagar · Ctrl+D duplicar · Ctrl+Z / Ctrl+Shift+Z · Ctrl+S salvar

Publicado via GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
