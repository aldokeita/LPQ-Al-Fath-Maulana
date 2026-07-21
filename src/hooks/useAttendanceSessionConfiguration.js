import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_ATTENDANCE_CONFIGURATION,
  fetchAttendanceConfiguration,
  getAttendanceSessionTimes,
} from '@/lib/attendanceConfiguration';

export const useAttendanceSessionConfiguration = () => {
  const [configuration, setConfiguration] = useState(DEFAULT_ATTENDANCE_CONFIGURATION);

  useEffect(() => {
    let active = true;
    fetchAttendanceConfiguration()
      .then(value => {
        if (active) setConfiguration(value);
      })
      .catch(() => {
        if (active) setConfiguration(DEFAULT_ATTENDANCE_CONFIGURATION);
      });

    return () => {
      active = false;
    };
  }, []);

  const sessionTimes = useMemo(
    () => getAttendanceSessionTimes(configuration),
    [configuration],
  );

  return { configuration, sessionTimes };
};
