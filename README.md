# pulsekid

DAW web minimalista focado em gravação e plugins. Arquivo único, sem dependências.

- Gravação multitrack com overdub, monitor de entrada e compensação de latência
- Rack de plugins por trilha e no master: reverb com editor visual (salas, RT60, pré-delay, abafar agudos, corte de graves), EQ visual (6 bandas com curva arrastável e espectro), EQ simples, compressor com editor visual (curva de transferência, nível ao vivo e medidor de redução de ganho), reverb, delay, drive, chorus, filtro, phaser, flanger, tremolo, bitcrush, limiter, noise gate
- Plugins de terceiros via WAM (Web Audio Modules): cole a URL do index.js do plugin (experimental)
- Afinador (correção de pitch tipo auto-tune): selecione um clipe e clique em "afinar"; escolha tom, escala, força e velocidade
- Medidor de afinação ao vivo: botão "medidor" mostra a nota e o desvio em centésimos de semitom enquanto você canta
- Metrônomo (bpm), contagem de 1 compasso antes de gravar, loop (arraste na régua) e snap à grade
- Edição de clipes: mover (inclusive entre trilhas), aparar bordas, fade in/out (bolinhas no topo do clipe), cortar, duplicar, apagar, desfazer/refazer
- Vários takes por trilha: gravar por cima de um trecho já gravado cria um novo take (botão tN/M na trilha troca; shift+clique apaga)
- Zoom horizontal e vertical (altura das trilhas)
- Projeto salvo automaticamente no navegador (IndexedDB), incluindo o estado dos plugins WAM; importar áudio e exportar WAV

Atalhos: espaço play/pause · R gravar · M metrônomo · L loop · S cortar · Delete apagar · Ctrl+D duplicar · Ctrl+Z / Ctrl+Shift+Z · Ctrl+S salvar

Publicado via GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

## Estrutura

```
index.html        estrutura da página
css/style.css     visual
js/core.js        estado global e AudioContext
js/plugins.js     rack de plugins (EQ simples, compressor, reverb, delay, drive, chorus, filtro, phaser, flanger, tremolo, bitcrush, limiter, noise gate)
js/eq.js          EQ visual: 6 bandas paramétricas, curva editável e analisador de espectro
js/comp.js        editor visual do compressor
js/reverb.js      reverb (resposta ao impulso determinística) e editor visual
js/audio.js       grafo de áudio, tempo/loop, transporte, metrônomo, gravação
js/clips.js       edição de clipes, fades, takes, desfazer/refazer
js/ui.js          renderização das trilhas e do painel de plugins
js/wam.js         plugins de terceiros (Web Audio Modules)
js/io.js          medidores, importar áudio, exportar WAV
js/project.js     salvar/carregar projeto (IndexedDB)
js/tuner.js       afinador offline e medidor de afinação ao vivo
js/main.js        zoom, atalhos e inicialização
```

Sem build e sem dependências: são scripts comuns que compartilham o mesmo escopo, carregados em ordem pelo `index.html`. A ordem dos `<script>` importa.
