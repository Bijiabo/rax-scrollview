import {createElement, useState, useRef} from 'rax';
import findDOMNode from 'rax-find-dom-node';
import {isWeex, isWeb} from 'universal-env';
import View from 'rax-view';
import Timer from './timer';

const DEFAULT_END_REACHED_THRESHOLD = 500;
const DEFAULT_SCROLL_CALLBACK_THROTTLE = 50;
const FULL_WIDTH = 750;
const STYLE_NODE_ID = 'rax-scrollview-style';


let ScrollView = (props) => {
  let {
    id,
    style,
    scrollEventThrottle,
    showsHorizontalScrollIndicator,
    showsVerticalScrollIndicator,
    onEndReached,
    onEndReachedThreshold,
    onScroll,
    children,
  } = props;

  let thisOnEndReachedThreshold = onEndReachedThreshold || DEFAULT_END_REACHED_THRESHOLD;
  let thisScrollEventThrottle = scrollEventThrottle || DEFAULT_SCROLL_CALLBACK_THROTTLE;
  let lastScrollDistance = 0;
  let lastScrollContentSize = 0;
  let thisLoadmoreretry = 1;
  let scrollerNode, scrollerNodeSize, scrollerContentNode;
  let [loadmoreretry, setLoadmoreretry] = useState(0);
  let scrollerEl = useRef(null);
  let contentContainerEl = useRef(null);

  let thisHandleScroll = (e) => {
    if (isWeb) {
      if (props.onScroll) {
        e.nativeEvent = {
          get contentOffset() {
            return {
              x: e.target.scrollLeft,
              y: e.target.scrollTop
            };
          },
          get contentSize() {
            return {
              width: e.target.scrollWidth,
              height: e.target.scrollHeight
            };
          }
        };
        props.onScroll(e);
      }

      if (props.onEndReached) {
        if (!scrollerNode) {
          scrollerNode = findDOMNode(scrollerEl.current);
          scrollerContentNode = findDOMNode(contentContainerEl.current);

          scrollerNodeSize = props.horizontal ? scrollerNode.offsetWidth : scrollerNode.offsetHeight;
        }

        // NOTE：in iOS7/8 offsetHeight/Width is is inaccurate （ use scrollHeight/Width ）
        let scrollContentSize = props.horizontal ? scrollerNode.scrollWidth : scrollerNode.scrollHeight;
        let scrollDistance = props.horizontal ? scrollerNode.scrollLeft : scrollerNode.scrollTop;
        let isEndReached = scrollContentSize - scrollDistance - scrollerNodeSize < thisOnEndReachedThreshold;

        let isScrollToEnd = scrollDistance > lastScrollDistance;
        let isLoadedMoreContent = scrollContentSize != lastScrollContentSize;

        if (isEndReached && isScrollToEnd && isLoadedMoreContent) {
          lastScrollContentSize = scrollContentSize;
          props.onEndReached(e);
        }


        lastScrollDistance = scrollDistance;
      }
    }
    if (isWeex) {
      e.nativeEvent = {
        contentOffset: {
          // HACK: weex scroll event value is opposite of web
          x: -e.contentOffset.x,
          y: -e.contentOffset.y
        },
        contentSize: e.contentSize ? {
          width: e.contentSize.width,
          height: e.contentSize.height
        } : null
      };
      props.onScroll(e);
    }
  };

  const resetScroll = () => {
    if (isWeb) {
      lastScrollContentSize = 0;
      lastScrollDistance = 0;
    } else {
      setLoadmoreretry({
        loadmoreretry: thisLoadmoreretry++,
      });
    }
  };

  // In weex must be int value
  onEndReachedThreshold = parseInt(onEndReachedThreshold, 10);

  const contentContainerStyle = [
    props.horizontal && styles.contentContainerHorizontal,
    props.contentContainerStyle,
  ];

  // bugfix: fix scrollview flex in ios 78
  if (!props.horizontal) {
    contentContainerStyle.push({...styles.viewBase, ...styles.containerWebStyle});
  }

  if (props.style) {
    let childLayoutProps = ['alignItems', 'justifyContent']
      .filter((prop) => props.style[prop] !== undefined);

    if (childLayoutProps.length !== 0) {
      console.warn(
        'ScrollView child layout (' + JSON.stringify(childLayoutProps) +
        ') must be applied through the contentContainerStyle prop.'
      );
    }
  }

  let refreshContainer = <View />, contentChild;
  if (Array.isArray(children)) {
    contentChild = children.map((child, index) => {
      return child;
    });
  } else {
    contentChild = children;
  }

  const contentContainer =
    <div
      ref={contentContainerEl}
      style={contentContainerStyle}>
      {contentChild}
    </div>;

  const baseStyle = props.horizontal ? styles.baseHorizontal : {...styles.viewBase, ...styles.baseVertical};

  const scrollerStyle = {
    ...baseStyle,
    ...props.style
  };

  let showsScrollIndicator = props.horizontal ? showsHorizontalScrollIndicator : showsVerticalScrollIndicator;

  if (isWeex) {
    return (
      <scroller
        {...props}
        style={scrollerStyle}
        showScrollbar={showsScrollIndicator}
        onLoadmore={onEndReached}
        onScroll={onScroll ? thisHandleScroll : null}
        loadmoreoffset={onEndReachedThreshold}
        loadmoreretry={loadmoreretry}
        scrollDirection={props.horizontal ? 'horizontal' : 'vertical'}
      >
        {refreshContainer}
        {contentContainer}
      </scroller>
    );
  } else {
    let handleScroll = thisHandleScroll;
    if (thisScrollEventThrottle) {
      handleScroll = throttle(handleScroll, thisScrollEventThrottle);
    }
    if (!showsScrollIndicator && typeof document !== 'undefined' && !document.getElementById(STYLE_NODE_ID)) {
      let styleNode = document.createElement('style');
      styleNode.id = STYLE_NODE_ID;
      document.head.appendChild(styleNode);
      styleNode.innerHTML = `.${props.className}::-webkit-scrollbar{display: none;}`;
    }

    scrollerStyle.webkitOverflowScrolling = 'touch';
    scrollerStyle.overflow = 'scroll';

    let webProps = {
      ...props,
      ...{
        ref: scrollerEl,
        style: scrollerStyle,
        onScroll: handleScroll
      }
    };
    delete webProps.onEndReachedThreshold;

    return (
      <div {...webProps}>
        {contentContainer}
      </div>
    );
  }
};

function throttle(func, wait) {
  var ctx, args, rtn, timeoutID;
  var last = 0;

  function call() {
    timeoutID = 0;
    last = +new Date();
    rtn = func.apply(ctx, args);
    ctx = null;
    args = null;
  }

  return function throttled() {
    ctx = this;
    args = arguments;
    var delta = new Date() - last;
    if (!timeoutID)
      if (delta >= wait) call();
      else timeoutID = setTimeout(call, wait - delta);
    return rtn;
  };
}

const styles = {
  viewBase: {
    border: '0 solid black',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignContent: 'flex-start',
    flexShrink: 0
  },
  baseVertical: {
    flex: 1,
    flexDirection: 'column',
  },
  baseHorizontal: {
    flex: 1,
    flexDirection: 'row',
  },
  contentContainerHorizontal: {
    flexDirection: 'row',
  },
  containerWebStyle: {
    display: 'block',
  }
};

export default ScrollView;