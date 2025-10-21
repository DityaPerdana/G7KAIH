import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = (await import("next/navigation")) as any;
const { __setMockParams, __getMockRouter, __resetMockRouter } = navigation;

const { default: SiswaKegiatanDetail } = await import("../page");

type FetchResponse = {
  ok: boolean
  status?: number
  jsonData?: any
  textData?: string
}

const originalFetch = global.fetch;
const originalFormData = global.FormData;

let fetchMock: ReturnType<typeof vi.fn>;
let lastFormData: FormDataMock | null = null;

class FormDataMock {
  private store = new Map<string, any[]>();

  constructor() {
    lastFormData = this;
  }

  append(key: string, value: any) {
    const list = this.store.get(key) ?? [];
    list.push(value);
    this.store.set(key, list);
  }

  getAll(key: string): any[] {
    return this.store.get(key) ?? [];
  }

  entries() {
    return Array.from(this.store.entries());
  }
}

describe("Siswa kegiatan detail page", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    global.FormData = FormDataMock as unknown as typeof FormData;
    __resetMockRouter();
    __setMockParams({ kegiatanid: "abc" });
    lastFormData = null;
  });

  afterEach(() => {
    fetchMock.mockReset();
    lastFormData = null;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
  });

  const queueResponses = (...responses: FetchResponse[]) => {
    fetchMock.mockImplementation(() => {
      const next = responses.shift();
      if (!next) {
        throw new Error("Unexpected fetch call");
      }
      return Promise.resolve({
        ok: next.ok,
        status: next.status ?? 200,
        json: async () => {
          if (next.jsonData !== undefined) return next.jsonData
          if (next.textData !== undefined) {
            try {
              return JSON.parse(next.textData)
            } catch {
              return next.textData
            }
          }
          return undefined
        },
        text: async () => {
          if (next.textData !== undefined) return next.textData
          if (next.jsonData !== undefined) return JSON.stringify(next.jsonData)
          return ""
        },
      })
    });
  };

  it("renders categories and submits values successfully", async () => {
    const user = userEvent.setup();

    queueResponses(
      {
        ok: true,
        jsonData: {
          data: {
            kegiatanname: "Kegiatan Pagi",
            submissionStatus: { canSubmit: true, lastSubmittedAt: null },
            categories: [
              {
                categoryid: "cat-1",
                categoryname: "Latihan",
                inputs: [
                  { key: "judul", label: "Judul Aktivitas", type: "text", required: true },
                  {
                    key: "opsi",
                    label: "Pilih kegiatan",
                    type: "multiselect",
                    config: { options: ["Push Up", "Sit Up"] }
                  }
                ]
              }
            ]
          }
        }
      },
      {
        ok: true,
        textData: JSON.stringify({ message: "ok" })
      }
    );

    render(<SiswaKegiatanDetail />);

    expect(await screen.findByText("Kegiatan Pagi")).toBeInTheDocument();
    expect(screen.getByText(/Latihan/)).toBeInTheDocument();

    const judulInput = screen.getByLabelText("Judul Aktivitas");
    await user.type(judulInput, "Senam Sehat");

    await user.click(screen.getByRole("checkbox", { name: "Push Up" }));

    const submitBtn = screen.getByRole("button", { name: /Kirim Aktivitas/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, postOptions] = fetchMock.mock.calls[1] || [];
    expect(postOptions?.method).toBe("POST");
    expect(postOptions?.body).toBeInstanceOf(FormDataMock);

    expect(lastFormData).not.toBeNull();
    expect(lastFormData?.getAll("kegiatanid")[0]).toBe("abc");
    const valuesPayload = JSON.parse(String(lastFormData?.getAll("values")[0] ?? "[]"));
    expect(valuesPayload[0].fields).toEqual([
      { key: "judul", type: "text", value: "Senam Sehat" },
      { key: "opsi", type: "multiselect", value: ["Push Up"] }
    ]);

    expect(await screen.findByText(/Aktivitas berhasil dikirim/i)).toBeInTheDocument();

    const router = __getMockRouter();
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/siswa");
    });
  });

  it("shows validation error when required field is missing", async () => {
    queueResponses({
      ok: true,
      jsonData: {
        data: {
          kegiatanname: "Latihan Siang",
          submissionStatus: { canSubmit: true, lastSubmittedAt: null },
          categories: [
            {
              categoryid: "cat",
              categoryname: "Kategori",
              inputs: [{ key: "catatan", label: "Catatan", type: "text", required: true }]
            }
          ]
        }
      }
    });

    render(<SiswaKegiatanDetail />);

    expect(await screen.findByText("Latihan Siang")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Kirim Aktivitas/i });
    const form = submitBtn.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(
      await screen.findByText((text) => text.includes("Kolom wajib: Catatan"))
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables inputs and submit when submission already locked", async () => {
    queueResponses({
      ok: true,
      jsonData: {
        data: {
          kegiatanname: "Latihan Malam",
          submissionStatus: { canSubmit: false, lastSubmittedAt: "2024-02-02T10:00:00Z" },
          categories: [
            {
              categoryid: "cat",
              categoryname: "Kategori",
              inputs: [{ key: "waktu", label: "Waktu", type: "time" }]
            }
          ]
        }
      }
    });

    render(<SiswaKegiatanDetail />);

    expect(await screen.findByText(/Pengiriman harian sudah dilakukan/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Waktu")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Kirim Aktivitas/i })).toBeDisabled();
  });

  it("shows error card when fetch fails", async () => {
    queueResponses({
      ok: false,
      status: 500,
      textData: JSON.stringify({ error: "Server error" })
    })

    render(<SiswaKegiatanDetail />);

    expect(await screen.findByText(/Server error/i)).toBeInTheDocument();
  });
});
