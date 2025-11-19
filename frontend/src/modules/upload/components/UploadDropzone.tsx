import { DragEvent } from "react";

interface UploadDropzoneProps {
  isDragActive: boolean;
  onDrag: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputId?: string;
}

function UploadDropzone({
  isDragActive,
  onDrag,
  onDrop,
  onFileChange,
  inputId = "file-input",
}: UploadDropzoneProps) {
  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-6 transition-colors ${
        isDragActive ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-50"
      }`}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
    >
      <input
        id={inputId}
        type="file"
        accept=".csv"
        onChange={onFileChange}
        className="absolute opacity-0 w-0 h-0"
      />
      <label
        htmlFor={inputId}
        className="flex flex-col items-center gap-3 text-center cursor-pointer"
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-inner text-slate-500">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">
            Drag & drop your CSV here
          </p>
          <p className="text-sm text-slate-500">
            or <span className="text-slate-900 underline">browse files</span>
          </p>
        </div>
        <div className="px-5 py-2 bg-slate-900 text-white rounded-full text-sm font-medium">
          Choose CSV File
        </div>
      </label>
    </div>
  );
}

export default UploadDropzone;

