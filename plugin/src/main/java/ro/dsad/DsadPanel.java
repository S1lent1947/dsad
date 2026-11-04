package ro.dsad;

import com.intellij.ide.BrowserUtil;
import com.intellij.openapi.Disposable;
import com.intellij.openapi.actionSystem.ActionManager;
import com.intellij.openapi.actionSystem.ActionPlaces;
import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.command.WriteCommandAction;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.fileEditor.FileEditorManager;
import com.intellij.openapi.project.DumbService;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.vfs.LocalFileSystem;
import com.intellij.openapi.vfs.VfsUtil;
import com.intellij.openapi.vfs.VfsUtilCore;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.ui.jcef.JBCefBrowser;
import com.intellij.ui.jcef.JBCefBrowserBase;
import com.intellij.ui.jcef.JBCefJSQuery;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.handler.CefLoadHandlerAdapter;

import javax.swing.*;
import java.awt.*;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.*;
import java.util.function.Supplier;

/**
 * Încarcă site-ul în browserul integrat (JCEF) și îi dă acces la proiect prin window.dsadIDE:
 *   projectInfo -> fișierele CSV (și PDF-ul subiectului) din proiect
 *   writeFiles  -> scrie main.py (+ functii.py) în proiect, îl deschide și îl rulează
 * Cererile vin ca text „comanda|id|cheie=base64|…”, răspunsurile ca JSON în base64.
 */
final class DsadPanel implements Disposable {
    static final String SITE = "https://s1lent1947.github.io/dsad/";
    private static final Set<String> SKIP_DIRS = Set.of("data_out", ".idea", ".git", "venv", ".venv", "env",
            "__pycache__", "node_modules", "site-packages", "build", "dist", ".ipynb_checkpoints");

    private final Project project;
    private final JBCefBrowser browser;
    private final JBCefJSQuery query;

    DsadPanel(Project project) {
        this.project = project;
        browser = JBCefBrowser.createBuilder().build();
        Disposer.register(this, browser);
        query = JBCefJSQuery.create((JBCefBrowserBase) browser);
        Disposer.register(this, query);
        query.addHandler(this::onQuery);
        browser.getJBCefClient().addLoadHandler(new CefLoadHandlerAdapter() {
            @Override
            public void onLoadEnd(CefBrowser b, CefFrame frame, int httpStatusCode) {
                if (frame != null && frame.isMain()) injectBridge(b);
            }
        }, browser.getCefBrowser());
        browser.loadURL(SITE + "?ide=1");
    }

    JComponent getComponent() {
        return browser.getComponent();
    }

    @Override
    public void dispose() {
        // browserul și interogarea sunt eliberate prin Disposer
    }

    static JComponent fallback() {
        JPanel panel = new JPanel(new BorderLayout(0, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        panel.add(new JLabel("<html>Browserul integrat (JCEF) nu merge în acest PyCharm.<br>Deschide site-ul în browser.</html>"), BorderLayout.NORTH);
        JButton open = new JButton("Deschide dsad.py în browser");
        open.addActionListener(e -> BrowserUtil.browse(SITE));
        JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        row.add(open);
        panel.add(row, BorderLayout.CENTER);
        return panel;
    }

    // ───────────── puntea JavaScript ↔ PyCharm ─────────────

    private void injectBridge(CefBrowser b) {
        String js = "(function(){if(window.dsadIDE)return;var pending={},seq=0;"
                + "function b64(s){return btoa(unescape(encodeURIComponent(s)));}"
                + "window.__dsadReply=function(id,data){var p=pending[id];if(!p)return;delete pending[id];var o;"
                + "try{o=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data),function(c){return c.charCodeAt(0);})));}"
                + "catch(e){o={ok:false,msg:String(e)};}p(o);};"
                + "window.dsadIDE={version:1,call:function(cmd,fields){return new Promise(function(resolve){"
                + "var id=++seq;pending[id]=resolve;var req=cmd+'|'+id;fields=fields||{};"
                + "for(var k in fields){if(Object.prototype.hasOwnProperty.call(fields,k)){req+='|'+k+'='+b64(String(fields[k]));}}"
                + query.inject("req")
                + "});}};window.dispatchEvent(new Event('dsad-ide-ready'));})();";
        b.executeJavaScript(js, b.getURL(), 0);
    }

    private JBCefJSQuery.Response onQuery(String req) {
        String[] parts = req.split("\\|", -1);
        if (parts.length < 2 || !parts[1].matches("\\d{1,9}")) {
            return new JBCefJSQuery.Response(null, 400, "cerere greșită");
        }
        String cmd = parts[0];
        String id = parts[1];
        Map<String, String> fields = new LinkedHashMap<>();
        for (int i = 2; i < parts.length; i++) {
            int eq = parts[i].indexOf('=');
            if (eq <= 0) continue;
            try {
                fields.put(parts[i].substring(0, eq),
                        new String(Base64.getDecoder().decode(parts[i].substring(eq + 1)), StandardCharsets.UTF_8));
            } catch (IllegalArgumentException ignored) {
                // câmp stricat: îl ignor
            }
        }
        switch (cmd) {
            case "projectInfo" -> ApplicationManager.getApplication()
                    .executeOnPooledThread(() -> reply(id, safely(this::projectInfo)));
            case "writeFiles" -> ApplicationManager.getApplication()
                    .invokeLater(() -> reply(id, safely(() -> writeFiles(fields))));
            default -> reply(id, error("Comandă necunoscută: " + cmd));
        }
        return new JBCefJSQuery.Response("ok");
    }

    private void reply(String id, String json) {
        String data = Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
        CefBrowser b = browser.getCefBrowser();
        b.executeJavaScript("window.__dsadReply&&window.__dsadReply(" + id + ",'" + data + "')", b.getURL(), 0);
    }

    // ───────────── projectInfo ─────────────

    private String projectInfo() {
        String basePath = project.getBasePath();
        if (basePath == null) return error("Proiectul nu are un folder pe disc.");
        Path base = Paths.get(basePath);
        List<Path> csv = new ArrayList<>();
        List<Path> pdf = new ArrayList<>();
        try {
            Files.walkFileTree(base, EnumSet.noneOf(FileVisitOption.class), 3, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    Path name = dir.getFileName();
                    if (!dir.equals(base) && name != null && SKIP_DIRS.contains(name.toString().toLowerCase(Locale.ROOT))) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    String n = file.getFileName().toString().toLowerCase(Locale.ROOT);
                    if (attrs.isRegularFile() && n.endsWith(".csv") && attrs.size() < 30_000_000L) csv.add(file);
                    else if (attrs.isRegularFile() && n.endsWith(".pdf") && attrs.size() < 20_000_000L) pdf.add(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            return error("Nu pot citi folderul proiectului: " + e.getMessage());
        }

        // folderul cu cele mai multe CSV-uri (la egalitate, data_in)
        Map<Path, List<Path>> byDir = new LinkedHashMap<>();
        for (Path p : csv) byDir.computeIfAbsent(p.getParent(), k -> new ArrayList<>()).add(p);
        Path inDir = null;
        for (Map.Entry<Path, List<Path>> e : byDir.entrySet()) {
            if (inDir == null) { inDir = e.getKey(); continue; }
            int a = e.getValue().size();
            int b = byDir.get(inDir).size();
            Path n = e.getKey().getFileName();
            if (a > b || (a == b && n != null && n.toString().equalsIgnoreCase("data_in"))) inDir = e.getKey();
        }

        StringBuilder sb = new StringBuilder("{\"ok\":true,\"project\":").append(js(project.getName()));
        String dirIn = inDir == null || inDir.equals(base) ? "" : base.relativize(inDir).toString().replace('\\', '/') + "/";
        sb.append(",\"dirIn\":").append(js(dirIn)).append(",\"files\":[");
        if (inDir != null) {
            List<Path> files = byDir.get(inDir);
            files.sort(Comparator.comparing(p -> p.getFileName().toString().toLowerCase(Locale.ROOT)));
            boolean first = true;
            for (Path p : files) {
                try {
                    String text = decode(Files.readAllBytes(p));
                    if (!first) sb.append(',');
                    first = false;
                    sb.append("{\"name\":").append(js(p.getFileName().toString())).append(",\"text\":").append(js(text)).append('}');
                } catch (IOException ignored) {
                    // fișier blocat: îl sar
                }
            }
        }
        sb.append("],\"pdf\":");
        Path newest = null;
        long newestTime = Long.MIN_VALUE;
        for (Path p : pdf) {
            try {
                long t = Files.getLastModifiedTime(p).toMillis();
                if (t > newestTime) { newestTime = t; newest = p; }
            } catch (IOException ignored) {
                // îl sar
            }
        }
        if (newest == null) sb.append("null");
        else {
            try {
                sb.append("{\"name\":").append(js(newest.getFileName().toString()))
                        .append(",\"b64\":\"").append(Base64.getEncoder().encodeToString(Files.readAllBytes(newest))).append("\"}");
            } catch (IOException e) {
                sb.append("null");
            }
        }
        return sb.append('}').toString();
    }

    // ───────────── writeFiles ─────────────

    private String writeFiles(Map<String, String> fields) {
        String basePath = project.getBasePath();
        if (basePath == null) return error("Proiectul nu are un folder pe disc.");
        VirtualFile baseDir = LocalFileSystem.getInstance().refreshAndFindFileByPath(basePath);
        if (baseDir == null) return error("Nu găsesc folderul proiectului.");

        Map<String, String> files = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : fields.entrySet()) {
            if (e.getKey().startsWith("file:")) files.put(e.getKey().substring(5), e.getValue());
        }
        if (!files.containsKey("main.py")) return error("Nu am primit main.py.");
        for (String n : files.keySet()) {
            if (!n.matches("[A-Za-z0-9_.-]+\\.py")) return error("Nume de fișier nepermis: " + n);
        }

        List<String> changed = new ArrayList<>();
        for (Map.Entry<String, String> e : files.entrySet()) {
            VirtualFile old = baseDir.findChild(e.getKey());
            if (old == null) continue;
            try {
                if (!VfsUtilCore.loadText(old).equals(e.getValue())) changed.add(e.getKey());
            } catch (IOException ex) {
                changed.add(e.getKey());
            }
        }
        if (!changed.isEmpty()) {
            String what = String.join(", ", changed);
            int answer = Messages.showYesNoDialog(project,
                    what + (changed.size() == 1 ? " există deja în proiect. Îl înlocuiesc" : " există deja în proiect. Le înlocuiesc")
                            + " cu codul generat?",
                    "DSAD", "Înlocuiește", "Anulează", Messages.getQuestionIcon());
            if (answer != Messages.YES) return "{\"ok\":false,\"msg\":" + js("Am lăsat fișierele din proiect neschimbate.") + "}";
        }

        String dirOut = fields.getOrDefault("dirOut", "").replace('\\', '/').replaceAll("^/+|/+$", "");
        if (dirOut.contains("..") || !dirOut.matches("[A-Za-z0-9_./-]*")) dirOut = "";
        final String outDir = dirOut;
        final VirtualFile[] mainFile = new VirtualFile[1];
        final String[] failure = new String[1];
        WriteCommandAction.runWriteCommandAction(project, "DSAD: scrie codul", null, () -> {
            try {
                for (Map.Entry<String, String> e : files.entrySet()) {
                    VirtualFile vf = baseDir.findChild(e.getKey());
                    if (vf == null) vf = baseDir.createChildData(DsadPanel.this, e.getKey());
                    VfsUtil.saveText(vf, e.getValue());
                    if (e.getKey().equals("main.py")) mainFile[0] = vf;
                }
                if (!outDir.isEmpty()) VfsUtil.createDirectoryIfMissing(baseDir, outDir);
            } catch (IOException ex) {
                failure[0] = ex.getMessage();
            }
        });
        if (failure[0] != null || mainFile[0] == null) return error("Nu am putut scrie fișierele: " + failure[0]);

        FileEditorManager.getInstance(project).openFile(mainFile[0], true);
        boolean run = "1".equals(fields.get("run"));
        if (run) {
            DumbService.getInstance(project).smartInvokeLater(() -> {
                Editor editor = FileEditorManager.getInstance(project).getSelectedTextEditor();
                AnAction action = ActionManager.getInstance().getAction("RunClass");
                if (editor != null && action != null) {
                    ActionManager.getInstance().tryToExecute(action, null, editor.getContentComponent(), ActionPlaces.UNKNOWN, true);
                }
            });
        }
        String written = String.join(", ", files.keySet());
        String where = outDir.isEmpty() ? "folderul proiectului" : outDir + "/";
        String msg = run
                ? "Am scris " + written + " și am pornit main.py. Rezultatele apar în " + where + ". Dacă nu pornește singur, apasă Ctrl+Shift+F10 în main.py."
                : "Am scris " + written + ".";
        return "{\"ok\":true,\"msg\":" + js(msg) + "}";
    }

    // ───────────── utilitare ─────────────

    private static String safely(Supplier<String> work) {
        try {
            return work.get();
        } catch (Throwable t) {
            return error("Eroare în plugin: " + t);
        }
    }

    private static String error(String msg) {
        return "{\"ok\":false,\"msg\":" + js(msg) + "}";
    }

    private static String decode(byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            return new String(bytes, Charset.forName("windows-1250"));
        }
    }

    private static String js(String s) {
        StringBuilder b = new StringBuilder(s.length() + 16).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20 || c == 0x2028 || c == 0x2029) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
                }
            }
        }
        return b.append('"').toString();
    }
}
