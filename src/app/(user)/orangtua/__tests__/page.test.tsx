import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const studentActivitiesRender = vi.fn((props: { studentId: string }) => (
  <div data-testid="student-activities">activities:{props.studentId}</div>
));

const commentSectionRender = vi.fn(
  (props: { siswaId: string; currentUserId: string }) => (
    <div data-testid="comment-section">
      komentar:{props.siswaId}:{props.currentUserId}
    </div>
  )
);

vi.mock("@/components/orangtua/StudentActivities", () => ({
  StudentActivities: (props: { studentId: string }) => studentActivitiesRender(props)
}));

vi.mock("@/components/komentar/CommentSection", () => ({
  CommentSection: (props: { siswaId: string; currentUserId: string }) => commentSectionRender(props)
}));

vi.mock("@/components/ui/logoutButton", () => ({
  __esModule: true,
  default: () => <button type="button">Logout</button>
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: vi.fn()
}));

const { useCurrentUser } = await import("@/hooks/use-current-user");
const useCurrentUserMock = useCurrentUser as unknown as Mock;

const { default: OrangTuaPage } = await import("../page");

const originalFetch = global.fetch;
let fetchMock: Mock;

const parentData = {
  parent: {
    userid: "parent-1",
    username: "Orang Tua",
    email: "parent@example.com",
    roleid: 5
  }
};

describe("Orang tua dashboard page", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    useCurrentUserMock.mockReturnValue({ userId: "parent-1", loading: false });
    studentActivitiesRender.mockClear();
    commentSectionRender.mockClear();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("prompts for login when no current user", async () => {
    useCurrentUserMock.mockReturnValue({ userId: null, loading: false });

    render(<OrangTuaPage />);

    expect(await screen.findByText(/Anda harus login/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders linked student dashboard with tabs and data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ...parentData,
          relationship_status: "linked",
          student: {
            userid: "student-9",
            username: "Siswa Hebat",
            kelas: "XI IPA 1",
            email: "student@example.com"
          }
        }
      })
    } as Response);

    render(<OrangTuaPage />);

    expect(await screen.findByText(/Dashboard Orang Tua/i)).toBeInTheDocument();
    expect(screen.getByText(/Ananda: Siswa Hebat/)).toBeInTheDocument();

    expect(studentActivitiesRender).toHaveBeenCalledWith({ studentId: "student-9" });
    expect(screen.getByTestId("student-activities").textContent).toContain("student-9");

    await waitFor(() => {
      expect(commentSectionRender).toHaveBeenCalledWith({
        siswaId: "student-9",
        currentUserId: "parent-1"
      });
    });
    expect(await screen.findByTestId("comment-section")).toHaveTextContent(
      "komentar:student-9:parent-1"
    );
  });

  it("shows available students when no relationship is set", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ...parentData,
          relationship_status: "no_relationship",
          student: null,
          message: "Belum terhubung",
          available_students: [
            { userid: "a", username: "Siswa A", kelas: "X A", email: null },
            { userid: "b", username: "Siswa B", kelas: null, email: null }
          ]
        }
      })
    } as Response);

    render(<OrangTuaPage />);

    expect(await screen.findByText(/Belum Ada Siswa Terhubung/i)).toBeInTheDocument();
    expect(screen.getByText(/Siswa yang tersedia: 2 siswa/)).toBeInTheDocument();
    expect(screen.getByText(/Siswa A/)).toBeInTheDocument();
  });

  it("surface errors from the API", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server down" })
    } as Response);

    render(<OrangTuaPage />);

    expect(await screen.findByText(/Error: Server down/i)).toBeInTheDocument();
  });

  it("hides unlink controls when a student is linked", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          ...parentData,
          relationship_status: "linked",
          student: {
            userid: "student-9",
            username: "Siswa Hebat",
            kelas: "XI IPA 1",
            email: "student@example.com"
          }
        }
      })
    } as Response);

    render(<OrangTuaPage />);

    expect(await screen.findByText(/Ananda: Siswa Hebat/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Putuskan Hubungan/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
