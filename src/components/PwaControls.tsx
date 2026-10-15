import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Download, RefreshCw, Share, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOnline } from "@/hooks/use-online";
import { registerPwa } from "@/lib/register-pwa";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaControls() {
  const online = useOnline();
  const { pathname } = useLocation();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [update, setUpdate] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void registerPwa(() => { if (!disposed) setUpdate(true); }).then((fn) => {
      if (disposed) fn(); else cleanup = fn;
    }).catch(() => {});
    const standalone = matchMedia("(display-mode: standalone)");
    const isInstalled = () => setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    isInstalled();
    setIos((/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent));
    try { setDismissed(sessionStorage.getItem("imperios:install-dismissed") === "1"); } catch { /* Storage may be unavailable. */ }
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const completed = () => { setInstalled(true); setPrompt(null); setInstructions(false); };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", completed);
    standalone.addEventListener("change", isInstalled);
    return () => {
      disposed = true; cleanup?.();
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", completed);
      standalone.removeEventListener("change", isInstalled);
    };
  }, []);

  const canInstall = pathname === "/" && !installed && !dismissed && (prompt || ios);
  return <>
    {!online && <div role="alert" className="pwa-connection"><WifiOff className="size-4 shrink-0" /><span>Conexão perdida. Reconecte para continuar; suas ações estão pausadas.</span></div>}
    {(canInstall || update) && <aside className="pwa-tools" aria-label="Aplicativo Impérios">
      {canInstall && <>
        <Button variant="outline" onClick={async () => {
          if (ios) { setInstructions(true); return; }
          if (!prompt) return;
          await prompt.prompt(); await prompt.userChoice; setPrompt(null);
        }}><Download className="size-4" />Instalar Impérios</Button>
        <Button variant="ghost" size="icon" aria-label="Dispensar instalação" onClick={() => {
          setDismissed(true); try { sessionStorage.setItem("imperios:install-dismissed", "1"); } catch { /* Optional preference. */ }
        }}><X className="size-4" /></Button>
      </>}
      {update && <Button variant="outline" disabled={!online} onClick={() => setConfirmUpdate(true)}><RefreshCw className="size-4" />Nova versão</Button>}
    </aside>}
    <Dialog open={instructions} onOpenChange={setInstructions}>
      <DialogContent className="border-bronze bg-background text-foreground">
        <DialogHeader><DialogTitle className="text-gold">Instalar Impérios no iPhone</DialogTitle><DialogDescription>Adicione o jogo à sua tela inicial pelo Safari.</DialogDescription></DialogHeader>
        <ol className="space-y-3 text-base"><li>1. Abra este endereço no Safari.</li><li>2. Toque em Compartilhar <Share className="inline size-4" />.</li><li>3. Escolha “Adicionar à Tela de Início”.</li><li>4. Confirme em “Adicionar”.</li></ol>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmUpdate} onOpenChange={setConfirmUpdate}>
      <DialogContent className="border-bronze bg-background text-foreground">
        <DialogHeader><DialogTitle className="text-gold">Atualizar Impérios?</DialogTitle><DialogDescription>{pathname.startsWith("/sala/") ? "A página será reaberta. Prefira atualizar ao terminar a partida; sua identificação nesta sala será preservada neste navegador." : "A página será reaberta com a nova versão do jogo."}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setConfirmUpdate(false)}>Mais tarde</Button><Button disabled={!online} onClick={() => window.location.reload()}><RefreshCw className="size-4" />Atualizar agora</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}