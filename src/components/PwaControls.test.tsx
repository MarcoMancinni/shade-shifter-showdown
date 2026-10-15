import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaControls } from "./PwaControls";

const mocks = vi.hoisted(() => ({ pathname: "/", update: null as (() => void) | null }));
vi.mock("@tanstack/react-router", () => ({ useLocation: () => ({ pathname: mocks.pathname }) }));
vi.mock("@/lib/register-pwa", () => ({ registerPwa: async (callback: () => void) => { mocks.update = callback; return () => {}; } }));
afterEach(() => { cleanup(); sessionStorage.clear(); mocks.pathname = "/"; vi.restoreAllMocks(); });

describe("install and update controls", () => {
  it("shows Android installation only after the browser offers it", async () => {
    render(<PwaControls />);
    expect(screen.queryByRole("button", { name: "Instalar Impérios" })).toBeNull();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => window.dispatchEvent(event));
    fireEvent.click(screen.getByRole("button", { name: "Instalar Impérios" }));
    expect(prompt).toHaveBeenCalledOnce();
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Instalar Impérios" })).toBeNull();
  });
  it("offers Safari instructions without pretending to automatically install", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Version/18.0 Mobile Safari/604.1");
    render(<PwaControls />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar Impérios" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
  });
  it("requires confirmation and allows delaying an update in a room", () => {
    mocks.pathname = "/sala/ABCDE";
    render(<PwaControls />);
    act(() => mocks.update?.());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nova versão" }));
    expect(screen.getByText(/Prefira atualizar ao terminar a partida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mais tarde" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Nova versão" })).toBeInTheDocument();
  });
  it("hides installation after appinstalled", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Safari/604.1");
    render(<PwaControls />);
    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(screen.queryByRole("button", { name: "Instalar Impérios" })).toBeNull();
  });
});