declare module 'node-pty' {
  export interface IPty {
    pid: number
    cols: number
    rows: number
    process: string
    onData(callback: (data: string) => void): void
    onExit(callback: (exitData: { exitCode: number; signal?: string }) => void): void
    write(data: string): void
    resize(cols: number, rows: number): void
    kill(signal?: string): void
  }

  export interface SpawnOptions {
    name?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: Record<string, string>
    executable?: string
    args?: string[]
  }

  export function spawn(
    command: string,
    args: string[] | undefined,
    options: SpawnOptions
  ): IPty

  export function openpty(
    size?: { cols: number; rows: number }
  ): {
    master: IPty
    slave: { pty: IPty }
  }

  export const nativePty: {
    openpty: typeof openpty
    spawn: typeof spawn
  }
}
