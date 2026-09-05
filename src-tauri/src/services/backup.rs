use std::io::{Read, Write, Cursor};
use std::path::Path;

/// Exports the database file as a zip archive.
/// Returns the zip bytes.
pub fn export_database(db_path: &Path) -> Result<Vec<u8>, String> {
    let db_content = std::fs::read(db_path)
        .map_err(|e| format!("读取数据库文件失败: {e}"))?;

    let buf = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buf);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("terminalvoice.db", options)
        .map_err(|e| format!("创建zip条目失败: {e}"))?;
    zip.write_all(&db_content)
        .map_err(|e| format!("写入zip失败: {e}"))?;

    let buf = zip.finish()
        .map_err(|e| format!("完成zip失败: {e}"))?;

    Ok(buf.into_inner())
}

/// Imports a database from zip archive bytes.
/// Replaces the current database file.
pub fn import_database(db_path: &Path, zip_bytes: &[u8]) -> Result<(), String> {
    let reader = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("读取zip失败: {e}"))?;

    // Look for terminalvoice.db in the archive
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("读取zip条目失败: {e}"))?;
        let name = file.name().to_string();
        if name == "terminalvoice.db" || name.ends_with(".db") {
            let mut content = Vec::new();
            file.read_to_end(&mut content)
                .map_err(|e| format!("解压失败: {e}"))?;

            // Write to a temp file first, then rename (atomic-ish)
            let tmp_path = db_path.with_extension("db.tmp");
            std::fs::write(&tmp_path, &content)
                .map_err(|e| format!("写入临时文件失败: {e}"))?;

            // Rename (replace original)
            std::fs::rename(&tmp_path, db_path)
                .map_err(|e| format!("替换数据库文件失败: {e}"))?;

            return Ok(());
        }
    }

    Err("zip 中未找到数据库文件".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn export_and_import_roundtrip() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Create a test file
        std::fs::write(&db_path, b"test database content").unwrap();

        // Export
        let zip_bytes = export_database(&db_path).unwrap();
        assert!(!zip_bytes.is_empty());

        // Modify original
        std::fs::write(&db_path, b"modified content").unwrap();

        // Import
        import_database(&db_path, &zip_bytes).unwrap();

        // Verify
        let content = std::fs::read(&db_path).unwrap();
        assert_eq!(content, b"test database content");
    }

    #[test]
    fn export_nonexistent_fails() {
        let result = export_database(Path::new("/nonexistent/path.db"));
        assert!(result.is_err());
    }

    #[test]
    fn import_invalid_zip_fails() {
        let result = import_database(Path::new("/tmp/test.db"), b"not a zip file");
        assert!(result.is_err());
    }
}
