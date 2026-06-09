import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchEmployeeAppointments,
  cancelAppointment,
  completeAppointment,
} from '../services/appointmentService';

const APPOINTMENTS_STALE_TIME = 30_000;

function employeeAppointmentsQueryKey(
  merchantId: string,
  employeeId: string,
  from: Date,
  to: Date,
) {
  return [
    'appointments',
    'employee',
    merchantId,
    employeeId,
    from.toISOString(),
    to.toISOString(),
  ] as const;
}

export function useEmployeeAppointments(
  merchantId: string | null,
  employeeId: string | null,
  from: Date,
  to: Date,
) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey:
      merchantId && employeeId
        ? employeeAppointmentsQueryKey(merchantId, employeeId, from, to)
        : ['appointments', 'employee', null],
    queryFn: () => fetchEmployeeAppointments(merchantId!, employeeId!, from, to),
    enabled: !!merchantId && !!employeeId,
    staleTime: APPOINTMENTS_STALE_TIME,
  });

  useFocusEffect(
    useCallback(() => {
      if (merchantId && employeeId && isStale) void refetch();
    }, [merchantId, employeeId, isStale, refetch]),
  );

  const invalidate = () => {
    if (merchantId && employeeId) {
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'employee', merchantId, employeeId],
      });
    }
  };

  const cancelMutation = useMutation({
    mutationFn: ({ appointmentId }: { appointmentId: string }) =>
      cancelAppointment(merchantId!, appointmentId),
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: ({ appointmentId }: { appointmentId: string }) =>
      completeAppointment(merchantId!, appointmentId),
    onSuccess: invalidate,
  });

  const errorKey = !merchantId || !employeeId
    ? 'merchant_branch_access_missing'
    : error
    ? 'appointments_load_failed'
    : null;

  return {
    appointments: data ?? [],
    loading: isLoading,
    error: errorKey,
    reload: refetch,
    cancel: cancelMutation.mutateAsync,
    complete: completeMutation.mutateAsync,
    mutating: cancelMutation.isPending || completeMutation.isPending,
    mutationError:
      cancelMutation.error?.message ?? completeMutation.error?.message ?? null,
  };
}
