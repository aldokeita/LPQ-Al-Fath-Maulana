
import { useCallback } from 'react';
import {
    deleteMmqAttendance,
    deleteMmqSchedule,
    fetchMmqAttendance,
    fetchMmqSchedules,
    getMmqErrorMessage,
    saveMmqAttendance,
    saveMmqSchedule,
} from '@/lib/mmqAdapters';

export const useMMQAttendance = () => {
    const fetchMMQSchedule = useCallback(async () => {
        try {
            return await fetchMmqSchedules();
        } catch (err) {
            return [];
        }
    }, []);

    const fetchMMQAttendance = useCallback(async ({ date }) => {
        try {
            return await fetchMmqAttendance({ date });
        } catch (err) {
            return [];
        }
    }, []);

    const saveMMQAttendance = useCallback(async (payload) => {
        try {
            const data = await saveMmqAttendance(payload);
            return { success: true, data };
        } catch (err) {
            return { success: false, error: getMmqErrorMessage(err) };
        }
    }, []);

    const deleteMMQAttendance = useCallback(async (id) => {
        try {
            await deleteMmqAttendance(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: getMmqErrorMessage(err) };
        }
    }, []);

    const updateMMQSchedule = useCallback(async (payload) => {
        try {
            const data = await saveMmqSchedule(payload);
            return { success: true, data };
        } catch (err) {
            return { success: false, error: getMmqErrorMessage(err) };
        }
    }, []);

    const deleteMMQSchedule = useCallback(async (id) => {
        try {
            await deleteMmqSchedule(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: getMmqErrorMessage(err) };
        }
    }, []);

    return {
        fetchMMQSchedule,
        fetchMMQAttendance,
        saveMMQAttendance,
        deleteMMQAttendance,
        updateMMQSchedule,
        deleteMMQSchedule
    };
};
