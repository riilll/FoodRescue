BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'JOB_KEDALUWARSA_PESANAN',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN sp_proses_kedaluwarsa; COMMIT; END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY;INTERVAL=1',
        enabled         => TRUE,
        auto_drop       => FALSE
    );
END;

SELECT log_date, status, error#, additional_info
FROM user_scheduler_job_run_details
WHERE job_name = 'JOB_KEDALUWARSA_PESANAN'
ORDER BY log_date DESC
FETCH FIRST 5 ROWS ONLY;

SELECT job_name, enabled, state, next_run_date
FROM user_scheduler_jobs
WHERE job_name = 'JOB_KEDALUWARSA_PESANAN';