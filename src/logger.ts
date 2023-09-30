import { join } from 'path'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';

type LogFunction = (message: any, ...rest: any) => void;
type LogProcess = (message: any, type: string, ...rest: any[]) => undefined;
interface Logger {
  debug: LogFunction;
  error: LogFunction;
  //debug: LogFunction;
  //error: LogFunction;
}

const MAX_CACHE_SIZE = 100;
const LOG_DIRECTORY = '.logger';

const env = setEnv(process.env.NODE_ENV || 'dev')
const log_cache = new Map<number, any>();

function setEnv(variable: string | undefined | null = 'dev'): string {
  if (variable && typeof variable === 'string' && (variable === 'production' || variable === 'prod')) {
    return 'prod'
  } else {
    return 'dev'
  }
}

function pad_left(number: number, pad = 2): string {
  return number.toString().padStart(pad, '0');
}

function format_date(date: Date | string | number): string {
  const date_object = new Date(date);
  const formatted_date = `${date_object.getFullYear()}-${pad_left(date_object.getMonth() + 1)}-${pad_left(date_object.getDate())}`;
  const formatted_time = `${pad_left(date_object.getHours())}:${pad_left(date_object.getMinutes())}:${pad_left(date_object.getSeconds())}`;
  return `${formatted_date} ${formatted_time}`;
}

function get_log_filename_date(date: Date | string | number): string {
  const date_object = new Date(date);
  const formatted_date = `${date_object.getFullYear()}-${pad_left(date_object.getMonth() + 1)}-${pad_left(date_object.getDate())}`;
  return formatted_date;
}

function write_log_to_console(message: any, type = 'log', ...rest): void {
  console.log(`${env.toUpperCase()} ${format_date(Date.now())}`);  
  
  if (type === "error") {
    console.error(message, ...rest);
  } else {
    console.log(message, ...rest)
  }
}

function write_log_to_cache(message: any, type = "log", ...rest: any): void {
  const timestamp = Date.now()
  const date = format_date(timestamp)

  if (type === 'error' && typeof message === "object") {
    message = message.message;
  }
  
  if (rest.length > 0) {
    rest = { rest }
  }
  
  log_cache.set(timestamp, { type, timestamp, date, message, ...rest });

  if (log_cache.size >= MAX_CACHE_SIZE) {
    write_log_cache_to_file();
  }
}

function write_log_cache_to_file(): void {
  if (!existsSync(LOG_DIRECTORY)) {
    mkdirSync(LOG_DIRECTORY);
  }

  const log_file_path = join(LOG_DIRECTORY, `${env.toUpperCase()}-${get_log_filename_date(Date.now())}.json`);
  const log_entries = Array.from(log_cache.values());

  if (existsSync(log_file_path)) {
    const existing_log_entries = JSON.parse(readFileSync(log_file_path, 'utf-8'));
    existing_log_entries.push(...log_entries);
    writeFileSync(log_file_path, JSON.stringify(existing_log_entries, null, 2));
  } else {
    writeFileSync(log_file_path, JSON.stringify(log_entries, null, 2));
  }

  log_cache.clear();
}

function process_log(message: any, type: string, ...rest: any[]): LogProcess {
  write_log_to_cache(message, type, ...rest);
  write_log_to_console(message, type, ...rest);
  return;
}

export function debug(): Logger {
  return {
    debug: (message, ...rest) => {
      //const type = 'log'
      process_log(message, 'log', ...rest)
      //write_log_to_cache(message, type, ...rest);
      //write_log_to_console(message, type, ...rest);
    },
    error: (message, ...rest) => {
      //const type = 'error'
      process_log(message, 'error', ...rest)
      //write_log_to_cache(message, type, ...rest);
      //write_log_to_console(message, type, ...rest);
    },
  }
}

export const logger: Logger = debug();
