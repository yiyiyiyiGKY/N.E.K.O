// Unity's WebGL player clears the default framebuffer alpha channel after the
// camera has rendered. On an alpha-enabled browser canvas that turns the
// transparent camera background into opaque black. Keep every normal clear,
// but suppress the alpha-only post-frame clear so the camera's alpha survives
// browser and Electron composition.
mergeInto(LibraryManager.library, {
  glClear: function (mask) {
    if (mask === 0x00004000) {
      var writeMask = GLctx.getParameter(GLctx.COLOR_WRITEMASK);
      if (!writeMask[0] && !writeMask[1] && !writeMask[2] && writeMask[3]) {
        return;
      }
    }
    GLctx.clear(mask);
  },

  // Unity 2022.3 can issue depth-only mesh draws while COLOR_ATTACHMENT0 is
  // still selected on its internal framebuffer. Newer ANGLE versions reject
  // that WebGL state instead of accepting the depth write. Unity-generated
  // color programs expose SV_TargetN; when none are linked, temporarily select
  // no color buffers for this draw and restore Unity's framebuffer state.
  glDrawElements: function (mode, count, type, indices) {
    var program = GLctx.getParameter(GLctx.CURRENT_PROGRAM);
    var framebuffer = GLctx.getParameter(GLctx.DRAW_FRAMEBUFFER_BINDING);
    var isDepthOnly = false;

    if (program && framebuffer && typeof GLctx.getFragDataLocation === 'function') {
      var cache = GLctx.__nekoDepthOnlyProgramCache;
      if (!cache) {
        cache = GLctx.__nekoDepthOnlyProgramCache = new WeakMap();
      }
      isDepthOnly = cache.get(program);
      if (isDepthOnly === undefined) {
        isDepthOnly = true;
        for (var output = 0; output < 4; output += 1) {
          if (GLctx.getFragDataLocation(program, 'SV_Target' + output) >= 0) {
            isDepthOnly = false;
            break;
          }
        }
        cache.set(program, isDepthOnly);
      }
    }

    if (isDepthOnly && GLctx.getParameter(GLctx.DRAW_BUFFER0) !== GLctx.NONE) {
      var drawBufferCount = GLctx.getParameter(GLctx.MAX_DRAW_BUFFERS);
      var previousDrawBuffers = [];
      var disabledDrawBuffers = [];
      for (var index = 0; index < drawBufferCount; index += 1) {
        previousDrawBuffers.push(GLctx.getParameter(GLctx.DRAW_BUFFER0 + index));
        disabledDrawBuffers.push(GLctx.NONE);
      }
      GLctx.drawBuffers(disabledDrawBuffers);
      try {
        GLctx.drawElements(mode, count, type, indices);
      } finally {
        GLctx.drawBuffers(previousDrawBuffers);
      }
      return;
    }

    GLctx.drawElements(mode, count, type, indices);
  }
});
