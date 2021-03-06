import {describe, beforeEach, it, expect, iit, ddescribe} from 'test_lib/test_lib';
import {isPresent, isBlank} from 'facade/lang';
import {DOM} from 'facade/dom';
import {List, ListWrapper} from 'facade/collection';

import {ProtoElementInjectorBuilder} from 'core/compiler/pipeline/proto_element_injector_builder';
import {CompilePipeline} from 'core/compiler/pipeline/compile_pipeline';
import {CompileElement} from 'core/compiler/pipeline/compile_element';
import {CompileStep} from 'core/compiler/pipeline/compile_step'
import {CompileControl} from 'core/compiler/pipeline/compile_control';
import {ProtoView} from 'core/compiler/view';
import {DirectiveMetadataReader} from 'core/compiler/directive_metadata_reader';
import {Template, Decorator, Component} from 'core/annotations/annotations';
import {ProtoElementInjector} from 'core/compiler/element_injector';

export function main() {
  describe('ProtoElementInjectorBuilder', () => {
    var protoElementInjectorBuilder, protoView;
    beforeEach( () => {
      protoElementInjectorBuilder = new TestableProtoElementInjectorBuilder();
      protoView = new ProtoView(null, null);
    });

    function createPipeline(directives = null) {
      if (isBlank(directives)) {
        directives = [];
      }
      var reader = new DirectiveMetadataReader();
      return new CompilePipeline([new MockStep((parent, current, control) => {
        if (isPresent(current.element.getAttribute('viewroot'))) {
          current.isViewRoot = true;
        }
        if (isPresent(current.element.getAttribute('directives'))) {
          for (var i=0; i<directives.length; i++) {
            current.addDirective(reader.read(directives[i]));
          }
        }
        current.inheritedProtoView = protoView;
      }), protoElementInjectorBuilder]);
    }

    function getCreationArgs(protoElementInjector) {
      return protoElementInjectorBuilder.findArgsFor(protoElementInjector);
    }

    it('should not create a ProtoElementInjector for elements without directives', () => {
      var results = createPipeline().process(createElement('<div></div>'));
      expect(results[0].inheritedProtoElementInjector).toBe(null);
    });

    it('should create a ProtoElementInjector for elements directives', () => {
      var directives = [SomeComponentDirective, SomeTemplateDirective, SomeDecoratorDirective];
      var results = createPipeline(directives).process(createElement('<div directives></div>'));
      var creationArgs = getCreationArgs(results[0].inheritedProtoElementInjector);
      expect(creationArgs['bindings']).toEqual(directives);
    });

    it('should mark ProtoElementInjector for elements with component directives and use the ComponentDirective as first binding', () => {
      var directives = [SomeDecoratorDirective, SomeComponentDirective];
      var results = createPipeline(directives).process(createElement('<div directives></div>'));
      var creationArgs = getCreationArgs(results[0].inheritedProtoElementInjector);
      expect(creationArgs['firstBindingIsComponent']).toBe(true);
      expect(creationArgs['bindings']).toEqual([SomeComponentDirective, SomeDecoratorDirective]);
    });

    it('should use the next ElementBinder index as index of the ProtoElementInjector', () => {
      // just adding some indices..
      ListWrapper.push(protoView.elementBinders, null);
      ListWrapper.push(protoView.elementBinders, null);
      var directives = [SomeDecoratorDirective];
      var results = createPipeline(directives).process(createElement('<div directives></div>'));
      var creationArgs = getCreationArgs(results[0].inheritedProtoElementInjector);
      expect(creationArgs['index']).toBe(protoView.elementBinders.length);
    });

    it('should inherit the ProtoElementInjector down to children without directives', () => {
      var directives = [SomeDecoratorDirective];
      var results = createPipeline(directives).process(createElement('<div directives><span></span></div>'));
      expect(results[1].inheritedProtoElementInjector).toBe(results[0].inheritedProtoElementInjector);
    });

    it('should use the ProtoElementInjector of the parent element as parent', () => {
      var el = createElement('<div directives><span><a directives></a></span></div>');
      var directives = [SomeDecoratorDirective];
      var results = createPipeline(directives).process(el);
      expect(results[2].inheritedProtoElementInjector.parent).toBe(
        results[0].inheritedProtoElementInjector);
    });

    it('should use a null parent for viewRoots', () => {
      var el = createElement('<div directives><span viewroot directives></span></div>');
      var directives = [SomeDecoratorDirective];
      var results = createPipeline(directives).process(el);
      expect(results[1].inheritedProtoElementInjector.parent).toBe(null);
    });

    it('should use a null parent if there is an intermediate viewRoot', () => {
      var el = createElement('<div directives><span viewroot><a directives></a></span></div>');
      var directives = [SomeDecoratorDirective];
      var results = createPipeline(directives).process(el);
      expect(results[2].inheritedProtoElementInjector.parent).toBe(null);
    });
  });
}


class TestableProtoElementInjectorBuilder extends ProtoElementInjectorBuilder {
  debugObjects:List;
  constructor() {
    this.debugObjects = [];
  }
  findArgsFor(protoElementInjector:ProtoElementInjector) {
    for (var i=0; i<this.debugObjects.length; i+=2) {
      if (this.debugObjects[i] === protoElementInjector) {
        return this.debugObjects[i+1];
      }
    }
    return null;
  }
  internalCreateProtoElementInjector(parent, index, bindings, firstBindingIsComponent) {
    var result = new ProtoElementInjector(parent, index, bindings, firstBindingIsComponent);
    ListWrapper.push(this.debugObjects, result);
    ListWrapper.push(this.debugObjects, {'parent': parent, 'index': index, 'bindings': bindings, 'firstBindingIsComponent': firstBindingIsComponent});
    return result;
  }
}

class MockStep extends CompileStep {
  processClosure:Function;
  constructor(process) {
    this.processClosure = process;
  }
  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    this.processClosure(parent, current, control);
  }
}

class SomeComponentService {}

@Template()
class SomeTemplateDirective {}

@Component({
  componentServices: [SomeComponentService]
})
class SomeComponentDirective {}

@Decorator()
class SomeDecoratorDirective {}

function createElement(html) {
  return DOM.createTemplate(html).content.firstChild;
}