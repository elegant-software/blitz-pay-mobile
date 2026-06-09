import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchMerchantAppointments,
  cancelAppointment,
  completeAppointment,
  rescheduleAppointment,
  overrideAppointment,
} from '../services/appointmentService';
import { fetchEmployees } from '../services/employeeService';
import type { RescheduleAppointmentRequest, OverrideAppointmentRequest } from '../types/appointment';

const APPOINTMENTS_STALE_TIME = 30_000;

function appointmentsQueryKey(merchantId: string, from: Date, to: Date) {
  return ['appointments', 'merchant', merchantId, from.toISOString(), to.toISOString()] as const;
}

export function useMerchantAppointments(
  merchantId: string | null,
  from: Date,
  to: Date,
) {
  const queryClient = useQueryClient();
  const key = merchantId ? appointmentsQueryKey(merchantId, from, to) : null;

  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: key ?? ['appointments', 'merchant', null],
    queryFn: () => fetchMerchantAppointments(merchantId!, from, to),
    enabled: !!merchantId,
    staleTime: APPOINTMENTS_STALE_TIME,
  });

  const { data: employees } = useQuery({
    queryKey: merchantId ? ['employees', merchantId] : ['employees', null],
    queryFn: () => fetchEmployees(merchantId!),
    enabled: !!merchantId,
    staleTime: 5 * 60_000,
  });

  const employeeNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const emp of employees ?? []) m.set(emp.id, emp.name);
    return m;
  }, [employees]);

  useFocusEffect(
    useCallback(() => {
      if (merchantId && isStale) void refetch();
    }, [merchantId, isStale, refetch]),
  );

  const invalidate = () => {
    if (merchantId) {
      void queryClient.invalidateQueries({ queryKey: ['appointments', 'merchant', merchantId] });
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

  const rescheduleMutation = useMutation({
    mutationFn: ({
      appointmentId,
      request,
    }: {
      appointmentId: string;
      request: RescheduleAppointmentRequest;
    }) => rescheduleAppointment(merchantId!, appointmentId, request),
    onSuccess: invalidate,
  });

  const overrideMutation = useMutation({
    mutationFn: ({
      appointmentId,
      request,
    }: {
      appointmentId: string;
      request: OverrideAppointmentRequest;
    }) => overrideAppointment(merchantId!, appointmentId, request),
    onSuccess: invalidate,
  });

  const errorKey = !merchantId
    ? 'merchant_branch_access_missing'
    : error
    ? 'appointments_load_failed'
    : null;

  return {
    appointments: data ?? [],
    employeeNameMap,
    loading: isLoading,
    error: errorKey,
    reload: refetch,
    cancel: cancelMutation.mutateAsync,
    complete: completeMutation.mutateAsync,
    reschedule: rescheduleMutation.mutateAsync,
    override: overrideMutation.mutateAsync,
    mutating:
      cancelMutation.isPending ||
      completeMutation.isPending ||
      rescheduleMutation.isPending ||
      overrideMutation.isPending,
    mutationError:
      cancelMutation.error?.message ??
      completeMutation.error?.message ??
      rescheduleMutation.error?.message ??
      overrideMutation.error?.message ??
      null,
  };
}
