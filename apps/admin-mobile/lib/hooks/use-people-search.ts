import { useQuery } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { adminApi } from "@/lib/api/admin-api";

export function useStudentSearch(search: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "students", "search", search],
    queryFn: () => adminApi.searchStudents(api, search),
    enabled: search.length >= 2,
    staleTime: 30_000,
  });
}

export function useStudent(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "students", id],
    queryFn: () => adminApi.getStudent(api, id),
    enabled: !!id,
  });
}

export function useStudentFees(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "students", id, "fees"],
    queryFn: () => adminApi.getStudentFees(api, id),
    enabled: !!id,
  });
}

export function useStudentAttendance(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "students", id, "attendance"],
    queryFn: () => adminApi.getStudentAttendance(api, id),
    enabled: !!id,
  });
}

export function useFacultySearch(search: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "faculty", "search", search],
    queryFn: () => adminApi.searchFaculty(api, search),
    enabled: search.length >= 2,
    staleTime: 30_000,
  });
}

export function useFaculty(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "faculty", id],
    queryFn: () => adminApi.getFaculty(api, id),
    enabled: !!id,
  });
}
