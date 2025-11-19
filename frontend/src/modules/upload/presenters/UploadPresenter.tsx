import { useState, useEffect, useRef, DragEvent } from "react";
import UploadHero from "../components/UploadHero";
import UploadDropzone from "../components/UploadDropzone";
import SelectedFileChip from "../components/SelectedFileChip";
import UploadMessage from "../components/UploadMessage";
import StatusPanel from "../components/StatusPanel";
import {
  fetchProcessingStatus,
  uploadCsv,
  StatusResponse,
} from "../services/uploadService";

function UploadPresenter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const uploadedCountRef = useRef<number>(0);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetchProcessingStatus();
        setStatus(response.data);

        const { queue, database } = response.data;
        const isComplete = queue.waiting === 0 && queue.active === 0;

        if (isComplete && uploadedCountRef.current > 0) {
          setIsPolling(false);
          const completed = database.completed;
          const failed = database.failed;
          const total = uploadedCountRef.current;

          if (completed > 0 || failed > 0) {
            setMessage({
              type: "success",
              text: `Processing complete! ${completed} completed, ${failed} failed out of ${total} URLs.`,
            });
            uploadedCountRef.current = 0;
          }
        }
      } catch (error) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling]);

  const handleFileChange = (file?: File) => {
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setMessage(null);
      setIsPolling(false);
      setStatus(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFileChange(file);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFileChange(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a file first" });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Content = (e.target?.result as string).split(",")[1];

          const response = await uploadCsv({
            csvContent: base64Content,
            fileName: selectedFile.name,
          });

          uploadedCountRef.current = response.data.urlCount;
          setMessage({
            type: "success",
            text: `Upload successful! Processing ${response.data.urlCount} URLs...`,
          });
          setIsPolling(true);
          setSelectedFile(null);
          setFileName("");
          const fileInput = document.getElementById(
            "file-input"
          ) as HTMLInputElement;
          if (fileInput) fileInput.value = "";
        } catch (error: any) {
          setMessage({
            type: "error",
            text:
              error.response?.data?.error || "Upload failed. Please try again.",
          });
          setIsPolling(false);
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setMessage({ type: "error", text: "Failed to read file" });
        setUploading(false);
        setIsPolling(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Upload failed. Please try again.",
      });
      setUploading(false);
      setIsPolling(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileName("");
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-10 shadow-[0_30px_80px_rgba(15,23,42,0.08)] border border-white text-slate-900">
        <UploadHero />
        <div className="flex flex-col gap-6">
          <UploadDropzone
            isDragActive={isDragActive}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onFileChange={handleInputChange}
          />

          {fileName && (
            <SelectedFileChip fileName={fileName} onClear={clearSelectedFile} />
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-base font-semibold cursor-pointer hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md disabled:translate-y-0"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading...
              </span>
            ) : (
              "Upload"
            )}
          </button>

          {message && <UploadMessage message={message} />}

          <StatusPanel
            status={status}
            isPolling={isPolling}
            uploadedCount={uploadedCountRef.current}
          />
        </div>
      </div>
    </div>
  );
}

export default UploadPresenter;
