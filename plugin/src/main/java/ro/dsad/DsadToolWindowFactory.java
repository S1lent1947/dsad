package ro.dsad;

import com.intellij.openapi.project.DumbAware;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.ui.content.Content;
import com.intellij.ui.content.ContentFactory;
import com.intellij.ui.jcef.JBCefApp;
import org.jetbrains.annotations.NotNull;

/** Panoul „DSAD” din dreapta: site-ul dsad.py, legat de proiectul deschis. */
public final class DsadToolWindowFactory implements ToolWindowFactory, DumbAware {
    @Override
    public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow toolWindow) {
        Content content;
        if (JBCefApp.isSupported()) {
            DsadPanel panel = new DsadPanel(project);
            content = ContentFactory.getInstance().createContent(panel.getComponent(), "", false);
            content.setDisposer(panel);
        } else {
            content = ContentFactory.getInstance().createContent(DsadPanel.fallback(), "", false);
        }
        toolWindow.getContentManager().addContent(content);
    }
}
