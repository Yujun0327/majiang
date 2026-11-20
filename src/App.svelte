<script lang="ts">
  import { makeRoomCode } from '@yujun/game-net'
  import { APP, loadPlayerName, playerKey } from './app/persist'
  import { OnlineSession } from './app/session.svelte'
  import GameScreen from './ui/GameScreen.svelte'
  import Home from './ui/Home.svelte'
  import Lobby from './ui/Lobby.svelte'

  let online = $state<OnlineSession | null>(null)

  function roomFromHash(): string | null {
    const m = location.hash.match(/room=([A-Za-z0-9]{4,})/)
    return m ? m[1].toUpperCase() : null
  }

  function syncFromHash() {
    const room = roomFromHash()
    if (room && online?.room !== room) {
      online?.destroy()
      const creator = sessionStorage.getItem(`${APP}:creator:${room}`) !== null
      online = new OnlineSession(room, creator, { key: playerKey(), name: loadPlayerName() })
    } else if (!room && online) {
      online.destroy()
      online = null
    }
  }

  syncFromHash()
  $effect(() => {
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  })

  // debugging handle (harmless in prod)
  $effect(() => {
    ;(window as unknown as Record<string, unknown>).__majiang = online
  })

  function createRoom() {
    const code = makeRoomCode()
    sessionStorage.setItem(`${APP}:creator:${code}`, '1')
    location.hash = `room=${code}`
  }

  function joinRoom(code: string) {
    location.hash = `room=${code.toUpperCase()}`
  }

  function exitToHome() {
    if (online) {
      online.leave()
      online = null
      location.hash = ''
    }
  }
</script>

{#if online}
  {#if online.playing}
    <GameScreen session={online} onExit={exitToHome} onRematch={() => online?.requestRematch()} />
  {:else}
    <Lobby session={online} onExit={exitToHome} />
  {/if}
{:else}
  <Home onCreateRoom={createRoom} onJoinRoom={joinRoom} />
{/if}
