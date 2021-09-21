import React, { FunctionComponent, useEffect } from "react";
import { RouteProp, useRoute } from "@react-navigation/native";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores";
import { PageWithView } from "../../components/page";
import { Text, View, Dimensions, Animated } from "react-native";
import { Button } from "../../components/button";
import { useStyle } from "../../styles";
import { useSmartNavigation } from "../../navigation";
import { RightArrowIcon } from "../../components/icon";
import LottieView from "lottie-react-native";
import * as WebBrowser from "expo-web-browser";

export const TxSuccessResultScreen: FunctionComponent = observer(() => {
  const { chainStore } = useStore();
  const [successAnimProgress] = React.useState(new Animated.Value(0));
  const [pangpareAnimProgress] = React.useState(new Animated.Value(0));

  const route = useRoute<
    RouteProp<
      Record<
        string,
        {
          chainId?: string;
          // Hex encoded bytes.
          txHash: string;
        }
      >,
      string
    >
  >();

  const chainId = route.params.chainId
    ? route.params.chainId
    : chainStore.current.chainId;
  const txHash = route.params.txHash;

  const style = useStyle();
  const smartNavigation = useSmartNavigation();

  const chainInfo = chainStore.getChain(chainId);

  useEffect(() => {
    const animateLottie = () => {
      Animated.timing(successAnimProgress, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }).start();
      Animated.timing(pangpareAnimProgress, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: false,
      }).start();
    };

    const timeoutId = setTimeout(animateLottie, 200);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageWithView
      disableSafeArea
      style={{
        paddingTop: Dimensions.get("window").height * 0.23,
        paddingBottom: Dimensions.get("window").height * 0.23,
        ...style.flatten([
          "padding-x-42",
          "items-center",
          "background-color-white",
        ]),
      }}
    >
      <View
        style={{
          left: 10,
          right: 0,
          top: -Dimensions.get("window").height * 0.5,
          bottom: 0,
          ...style.flatten(["absolute", "justify-center", "items-center"]),
        }}
      >
        <LottieView
          source={require("../../assets/lottie/pangpare.json")}
          progress={pangpareAnimProgress}
          style={style.flatten(["width-full", "height-400"])}
        />
      </View>
      <View style={style.flatten(["width-122", "height-122"])}>
        <View
          style={{
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            ...style.flatten([
              "absolute",
              "justify-center",
              "items-center",
              "background-color-white",
            ]),
          }}
        >
          <LottieView
            source={require("../../assets/lottie/success.json")}
            progress={successAnimProgress}
            style={style.flatten(["width-160"])}
          />
        </View>
      </View>
      <Text style={style.flatten(["h2", "margin-top-82", "margin-bottom-32"])}>
        Transaction successful
      </Text>
      <Text
        style={style.flatten(["body1", "text-center", "color-text-black-low"])}
      >
        Congratulations!
      </Text>
      <Text
        style={style.flatten(["body1", "text-center", "color-text-black-low"])}
      >
        Your transaction has been completed and confirmed by the blockchain.
      </Text>
      <View style={style.flatten(["flex-row"])}>
        <Button
          containerStyle={style.flatten(["margin-top-58", "flex-1"])}
          size="large"
          text="Confirm"
          onPress={() => {
            smartNavigation.navigateSmart("Home", {});
          }}
        />
      </View>
      {chainInfo.raw.txExplorer ? (
        <Button
          containerStyle={style.flatten(["margin-top-21"])}
          size="default"
          text={`View on ${chainInfo.raw.txExplorer.name}`}
          mode="text"
          rightIcon={
            <View style={style.flatten(["margin-left-8"])}>
              <RightArrowIcon
                color={style.get("color-primary").color}
                height={12}
              />
            </View>
          }
          onPress={() => {
            if (chainInfo.raw.txExplorer) {
              WebBrowser.openBrowserAsync(
                chainInfo.raw.txExplorer.txUrl.replace(
                  "{txHash}",
                  txHash.toUpperCase()
                )
              );
            }
          }}
        />
      ) : null}
    </PageWithView>
  );
});
